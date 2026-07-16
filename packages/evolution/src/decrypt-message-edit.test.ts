import { describe, expect, it } from "vitest";

import {
  aesGcmEncrypt,
  decryptMessageEdit,
  derivarChaveMessageEdit,
  extrairTextoDeMessageProtobuf,
  jidSemDevice,
  protoMessageConversation,
  protoMessageEditProtocol,
} from "./decrypt-message-edit";
import { parseGoMessageEvent, SECRET_ENC_TYPE_MESSAGE_EDIT } from "./webhook-go";

function bytesParaBase64(bytes: Uint8Array): string {
  if (typeof Buffer !== "undefined") return Buffer.from(bytes).toString("base64");
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s);
}

describe("decrypt-message-edit", () => {
  it("jidSemDevice remove :device", () => {
    expect(jidSemDevice("5511999:97@s.whatsapp.net")).toBe("5511999@s.whatsapp.net");
    expect(jidSemDevice("123@lid")).toBe("123@lid");
  });

  it("extrai conversation do protobuf", () => {
    const buf = protoMessageConversation("olá editado");
    expect(extrairTextoDeMessageProtobuf(buf)).toBe("olá editado");
  });

  it("extrai protocolMessage.editedMessage do protobuf", () => {
    const buf = protoMessageEditProtocol("texto novo");
    expect(extrairTextoDeMessageProtobuf(buf)).toBe("texto novo");
  });

  it("round-trip HKDF + AES-GCM MESSAGE_EDIT", async () => {
    const messageSecret = crypto.getRandomValues(new Uint8Array(32));
    const origMsgId = "AC9A902ED6D1458D0A9FB5C4023580E7";
    const origSender = "554688043494@s.whatsapp.net";
    const editor = "554688043494@s.whatsapp.net";
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const plaintext = protoMessageEditProtocol("Edited message");

    const key = await derivarChaveMessageEdit({
      messageSecret,
      origMsgId,
      origSenderJid: origSender,
      editorJid: editor,
    });
    const encPayload = await aesGcmEncrypt(key, iv, plaintext);

    const texto = await decryptMessageEdit({
      messageSecret: bytesParaBase64(messageSecret),
      origMsgId,
      origSenderJids: [origSender, "zzz@lid"],
      editorJid: editor,
      encIv: bytesParaBase64(iv),
      encPayload: bytesParaBase64(encPayload),
    });
    expect(texto).toBe("Edited message");
  });

  it("falha com messageSecret errado", async () => {
    const messageSecret = crypto.getRandomValues(new Uint8Array(32));
    const wrongSecret = crypto.getRandomValues(new Uint8Array(32));
    const origMsgId = "ID-1";
    const jid = "5511@s.whatsapp.net";
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const key = await derivarChaveMessageEdit({
      messageSecret,
      origMsgId,
      origSenderJid: jid,
      editorJid: jid,
    });
    const encPayload = await aesGcmEncrypt(key, iv, protoMessageConversation("x"));

    const texto = await decryptMessageEdit({
      messageSecret: bytesParaBase64(wrongSecret),
      origMsgId,
      origSenderJids: [jid],
      editorJid: jid,
      encIv: iv,
      encPayload,
    });
    expect(texto).toBeNull();
  });
});

describe("parseGoMessageEvent edições", () => {
  it("protocolMessage MESSAGE_EDIT vira type edit", () => {
    const parsed = parseGoMessageEvent({
      Info: {
        Chat: "5511999@s.whatsapp.net",
        Sender: "5511999@s.whatsapp.net",
        ID: "EDIT-EVT-1",
        IsFromMe: false,
        Timestamp: "2026-07-16T12:00:00-03:00",
      },
      Message: {
        protocolMessage: {
          type: 14,
          key: { ID: "ORIG-1" },
          editedMessage: { conversation: "texto atualizado" },
        },
      },
    });
    expect(parsed).toMatchObject({
      type: "edit",
      body: "texto atualizado",
      editTargetId: "ORIG-1",
    });
  });

  it("secretEncryptedMessage MESSAGE_EDIT vira edit_encrypted (shape issue #92)", () => {
    const parsed = parseGoMessageEvent({
      Info: {
        Chat: "xxx@s.whatsapp.net",
        Sender: "xxx@s.whatsapp.net",
        SenderAlt: "zzz@lid",
        ID: "AC1A92123AFBE559D5F9A4B302CF6C7F",
        IsFromMe: false,
        Edit: "1",
        Timestamp: "2026-06-26T02:39:33-03:00",
        Type: "text",
        MsgBotInfo: { EditTargetID: "", EditType: "" },
      },
      Message: {
        messageContextInfo: { deviceListMetadataVersion: 2 },
        secretEncryptedMessage: {
          encIV: "+LyXMWj3ktXD7Bsa",
          encPayload:
            "IH6QaddsawnKQf726+G4S4gWWzhDivIQ737Rd4RpsB3lC2zYUkCP61hC/1ih37pDYuDTR5dKVJ1PM7ctir9rFcc6ePro6RBok3e3CwcCNdhHwb+V1dj09QkOZIHWigfTeKGMKjw7jAI+yxlTlPGJCPTG9VghlUsRV4MSmz5dQZMDH8CHpVmKmb+M0yKi",
          secretEncType: SECRET_ENC_TYPE_MESSAGE_EDIT,
          targetMessageKey: {
            ID: "AC9A902ED6D1458D0A9FB5C4023580E7",
            fromMe: true,
            remoteJID: "zzz@lid",
          },
        },
      },
      IsEdit: false,
    });
    expect(parsed).toMatchObject({
      type: "edit_encrypted",
      editTargetId: "AC9A902ED6D1458D0A9FB5C4023580E7",
      body: "",
    });
    expect(parsed?.editEncrypted?.encIv.length).toBeGreaterThan(0);
    expect(parsed?.editEncrypted?.encPayload.length).toBeGreaterThan(0);
    expect(parsed?.body).not.toBe("[mensagem criptografada]");
  });

  it("extrai messageSecret de mensagem normal", () => {
    const parsed = parseGoMessageEvent({
      Info: {
        Chat: "5511@s.whatsapp.net",
        Sender: "5511@s.whatsapp.net",
        ID: "MSG-1",
        IsFromMe: false,
        Timestamp: "2026-07-16T12:00:00Z",
      },
      Message: {
        conversation: "oi",
        messageContextInfo: {
          messageSecret: "mA5k/3jCDF8qB5WmVUnZtAuKEsY9z8e4Ja6mHpFmR/A=",
        },
      },
    });
    expect(parsed).toMatchObject({
      type: "text",
      body: "oi",
      messageSecret: "mA5k/3jCDF8qB5WmVUnZtAuKEsY9z8e4Ja6mHpFmR/A=",
      senderJid: "5511@s.whatsapp.net",
    });
  });

  it("secretEncryptedMessage sem MESSAGE_EDIT é ignorado", () => {
    const parsed = parseGoMessageEvent({
      Info: {
        Chat: "5511@s.whatsapp.net",
        Sender: "5511@s.whatsapp.net",
        ID: "X",
        IsFromMe: false,
      },
      Message: {
        secretEncryptedMessage: {
          secretEncType: 1,
          encIV: "aaaa",
          encPayload: "bbbb",
          targetMessageKey: { ID: "T" },
        },
      },
    });
    expect(parsed).toBeNull();
  });
});
