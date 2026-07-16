/**
 * Descriptografa envelopes `secretEncryptedMessage` (MESSAGE_EDIT),
 * alinhado ao whatsmeow (`EncSecretMessageEdit` / `decryptMsgSecret`).
 */
import { bytesDeCampoGo } from "./webhook-go";

const ENC_SECRET_MESSAGE_EDIT = "Message Edit";

/** Remove o sufixo `:device` do user JID (whatsmeow `ToNonAD`). */
export function jidSemDevice(jid: string): string {
  const at = jid.indexOf("@");
  if (at < 0) return jid;
  const user = jid.slice(0, at);
  const server = jid.slice(at);
  const colon = user.indexOf(":");
  if (colon < 0) return jid;
  return `${user.slice(0, colon)}${server}`;
}

function concatUtf8(parts: string[]): Uint8Array {
  const encoded = parts.map((p) => new TextEncoder().encode(p));
  const total = encoded.reduce((n, b) => n + b.length, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const chunk of encoded) {
    out.set(chunk, offset);
    offset += chunk.length;
  }
  return out;
}

/**
 * Deriva a chave AES-GCM (32 bytes) via HKDF-SHA256.
 * info = origMsgID + origSender + editor + "Message Edit" (concatenação raw).
 */
export async function derivarChaveMessageEdit(params: {
  messageSecret: Uint8Array;
  origMsgId: string;
  origSenderJid: string;
  editorJid: string;
}): Promise<Uint8Array> {
  const info = concatUtf8([
    params.origMsgId,
    jidSemDevice(params.origSenderJid),
    jidSemDevice(params.editorJid),
    ENC_SECRET_MESSAGE_EDIT,
  ]);
  const baseKey = await crypto.subtle.importKey("raw", params.messageSecret, "HKDF", false, [
    "deriveBits",
  ]);
  const bits = await crypto.subtle.deriveBits(
    {
      name: "HKDF",
      hash: "SHA-256",
      salt: new Uint8Array(32),
      info,
    },
    baseKey,
    256,
  );
  return new Uint8Array(bits);
}

/** AES-256-GCM; `ciphertext` = payload || tag (16 bytes), como no Go `cipher.AEAD`. */
export async function aesGcmDecrypt(
  key: Uint8Array,
  iv: Uint8Array,
  ciphertext: Uint8Array,
): Promise<Uint8Array> {
  const cryptoKey = await crypto.subtle.importKey("raw", key, { name: "AES-GCM" }, false, [
    "decrypt",
  ]);
  const plain = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, cryptoKey, ciphertext);
  return new Uint8Array(plain);
}

/** AES-256-GCM seal (para testes round-trip). */
export async function aesGcmEncrypt(
  key: Uint8Array,
  iv: Uint8Array,
  plaintext: Uint8Array,
): Promise<Uint8Array> {
  const cryptoKey = await crypto.subtle.importKey("raw", key, { name: "AES-GCM" }, false, [
    "encrypt",
  ]);
  const sealed = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, cryptoKey, plaintext);
  return new Uint8Array(sealed);
}

function readVarint(buf: Uint8Array, offset: number): [value: number, next: number] {
  let result = 0;
  let shift = 0;
  let pos = offset;
  while (pos < buf.length) {
    const byte = buf[pos++]!;
    result |= (byte & 0x7f) << shift;
    if ((byte & 0x80) === 0) return [result >>> 0, pos];
    shift += 7;
    if (shift > 35) throw new Error("varint inválido");
  }
  throw new Error("EOF no varint");
}

function readLenBytes(buf: Uint8Array, offset: number): [value: Uint8Array, next: number] {
  const [len, afterLen] = readVarint(buf, offset);
  const end = afterLen + len;
  if (end > buf.length) throw new Error("EOF no length-delimited");
  return [buf.subarray(afterLen, end), end];
}

type ProtoField =
  | { field: number; wire: 0; value: number }
  | { field: number; wire: 2; value: Uint8Array };

function* iterProtoFields(buf: Uint8Array): Generator<ProtoField> {
  let offset = 0;
  while (offset < buf.length) {
    const [tag, afterTag] = readVarint(buf, offset);
    const field = tag >>> 3;
    const wire = tag & 7;
    offset = afterTag;
    if (wire === 0) {
      const [value, next] = readVarint(buf, offset);
      yield { field, wire: 0, value };
      offset = next;
    } else if (wire === 2) {
      const [value, next] = readLenBytes(buf, offset);
      yield { field, wire: 2, value };
      offset = next;
    } else if (wire === 1) {
      offset += 8;
    } else if (wire === 5) {
      offset += 4;
    } else {
      throw new Error(`wire type não suportado: ${wire}`);
    }
  }
}

function utf8DeBytes(bytes: Uint8Array): string {
  return new TextDecoder().decode(bytes);
}

/**
 * Extrai texto de um `waE2E.Message` protobuf mínimo
 * (conversation / extendedTextMessage / protocolMessage.editedMessage / editedMessage).
 */
export function extrairTextoDeMessageProtobuf(buf: Uint8Array): string | null {
  let conversation: string | null = null;
  let extendedText: string | null = null;
  let fromProtocol: string | null = null;
  let fromEditedWrapper: string | null = null;

  for (const f of iterProtoFields(buf)) {
    if (f.field === 1 && f.wire === 2) {
      conversation = utf8DeBytes(f.value);
    } else if (f.field === 6 && f.wire === 2) {
      for (const inner of iterProtoFields(f.value)) {
        if (inner.field === 1 && inner.wire === 2) {
          extendedText = utf8DeBytes(inner.value);
          break;
        }
      }
    } else if (f.field === 12 && f.wire === 2) {
      for (const inner of iterProtoFields(f.value)) {
        if (inner.field === 14 && inner.wire === 2) {
          fromProtocol = extrairTextoDeMessageProtobuf(inner.value);
          break;
        }
      }
    } else if (f.field === 58 && f.wire === 2) {
      for (const inner of iterProtoFields(f.value)) {
        if (inner.field === 1 && inner.wire === 2) {
          fromEditedWrapper = extrairTextoDeMessageProtobuf(inner.value);
          break;
        }
      }
    }
  }

  const candidatos = [conversation, extendedText, fromProtocol, fromEditedWrapper];
  for (const texto of candidatos) {
    if (texto && texto.trim()) return texto.trim();
  }
  return null;
}

/** Codifica string protobuf length-delimited (para testes). */
export function protoEncodeStringField(field: number, value: string): Uint8Array {
  const str = new TextEncoder().encode(value);
  return protoEncodeLenField(field, str);
}

export function protoEncodeVarintField(field: number, value: number): Uint8Array {
  const tag = (field << 3) | 0;
  return concatBytes([encodeVarint(tag), encodeVarint(value)]);
}

export function protoEncodeLenField(field: number, value: Uint8Array): Uint8Array {
  const tag = (field << 3) | 2;
  return concatBytes([encodeVarint(tag), encodeVarint(value.length), value]);
}

function encodeVarint(value: number): Uint8Array {
  const bytes: number[] = [];
  let v = value >>> 0;
  while (v >= 0x80) {
    bytes.push((v & 0x7f) | 0x80);
    v >>>= 7;
  }
  bytes.push(v);
  return Uint8Array.from(bytes);
}

function concatBytes(parts: Uint8Array[]): Uint8Array {
  const total = parts.reduce((n, p) => n + p.length, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const p of parts) {
    out.set(p, offset);
    offset += p.length;
  }
  return out;
}

/** Message{ conversation } protobuf (para testes). */
export function protoMessageConversation(text: string): Uint8Array {
  return protoEncodeStringField(1, text);
}

/** Message{ protocolMessage{ type=MESSAGE_EDIT, editedMessage{ conversation } } }. */
export function protoMessageEditProtocol(text: string): Uint8Array {
  const edited = protoMessageConversation(text);
  const protocol = concatBytes([
    protoEncodeVarintField(2, 14), // type = MESSAGE_EDIT
    protoEncodeLenField(14, edited), // editedMessage
  ]);
  return protoEncodeLenField(12, protocol); // protocolMessage
}

export type DecryptMessageEditParams = {
  messageSecret: string | Uint8Array;
  origMsgId: string;
  /** Candidatos de JID do remetente original (PN e/ou LID). */
  origSenderJids: string[];
  /** JID de quem editou (`Info.Sender`). */
  editorJid: string;
  encIv: Uint8Array | string;
  encPayload: Uint8Array | string;
};

/**
 * Descriptografa MESSAGE_EDIT e devolve o texto novo.
 * Tenta cada `origSenderJids` (hack LID/PN do whatsmeow).
 */
export async function decryptMessageEdit(
  params: DecryptMessageEditParams,
): Promise<string | null> {
  const secret =
    typeof params.messageSecret === "string"
      ? bytesDeCampoGo(params.messageSecret)
      : params.messageSecret;
  const iv = typeof params.encIv === "string" ? bytesDeCampoGo(params.encIv) : params.encIv;
  const payload =
    typeof params.encPayload === "string"
      ? bytesDeCampoGo(params.encPayload)
      : params.encPayload;
  if (!secret || !iv || !payload) return null;

  const candidatos = [
    ...new Set(params.origSenderJids.map(jidSemDevice).filter((j) => j.length > 0)),
  ];
  if (candidatos.length === 0) return null;

  for (const origSender of candidatos) {
    try {
      const key = await derivarChaveMessageEdit({
        messageSecret: secret,
        origMsgId: params.origMsgId,
        origSenderJid: origSender,
        editorJid: params.editorJid,
      });
      const plain = await aesGcmDecrypt(key, iv, payload);
      const texto = extrairTextoDeMessageProtobuf(plain);
      if (texto) return texto;
    } catch {
      // tenta próximo candidato
    }
  }
  return null;
}
