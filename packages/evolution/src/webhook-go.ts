import {
  formatInteractiveBody,
  formatInteractiveResponseBody,
  parseFlowResponseDeExtraData,
  parseInteractiveMessage,
  parseInteractiveResponseMessage,
  type GoFlowResponse,
} from "./flow-parser";

export type EvolutionGoWebhookPayload = {
  event?: string;
  instance?: string;
  instanceName?: string;
  instanceId?: string;
  instanceToken?: string;
  state?: string;
  data?: Record<string, unknown>;
};

/** Enquete estruturada (pollCreationMessage / V3). */
export type GoPollPayload = {
  name: string;
  options: string[];
  selectableOptionsCount?: number;
};

/** Envelope MESSAGE_EDIT ainda criptografado (secretEncType=2). */
export type GoEditEncrypted = {
  editTargetId: string;
  encIv: Uint8Array;
  encPayload: Uint8Array;
};

/** Contexto de reply/menção/encaminhamento extraído de `contextInfo`. */
export type GoMessageContextInfo = {
  mentionedJids?: string[];
  quotedStanzaId?: string;
  quotedParticipant?: string;
  quotedType?: number | null;
  isForwarded?: boolean;
  forwardingScore?: number | null;
};

/** Metadados de grupo embutidos em Message (`groupData`). */
export type GoGroupData = {
  jid: string;
  name: string | null;
  participants: Array<{ lidJid: string; pnJid: string | null }>;
};

export type GoMensagemNormalizada = {
  chatJid: string;
  messageId: string;
  fromMe: boolean;
  pushName: string | null;
  body: string;
  type: string;
  timestamp: Date | null;
  isGroup: boolean;
  messageObj: Record<string, unknown>;
  poll?: GoPollPayload;
  /** idExterno da mensagem original (tipos `edit` / `edit_encrypted`). */
  editTargetId?: string;
  /** Payload AES-GCM quando `type === "edit_encrypted"`. */
  editEncrypted?: GoEditEncrypted;
  /** `messageContextInfo.messageSecret` (base64), se presente. */
  messageSecret?: string;
  /** JID do remetente (`Info.Sender`), para HKDF de edições. */
  senderJid?: string;
  /** Alternativa LID/PN (`Info.SenderAlt` / `RecipientAlt`). */
  senderJidAlt?: string;
  /** Reply / menções / encaminhamento. */
  contextInfo?: GoMessageContextInfo;
  /** Snapshot de grupo quando o webhook inclui `groupData`. */
  groupData?: GoGroupData;
};

export type GoHistorySyncConversa = {
  jid: string;
  nome: string | null;
  unreadCount: number;
  messages: Array<{
    messageId: string;
    chatJid: string;
    fromMe: boolean;
    body: string;
    type: string;
    timestamp: Date | null;
    status: string | null;
    messageObj: Record<string, unknown>;
    poll?: GoPollPayload;
  }>;
};

type GoCorpoParseado = {
  body: string;
  type: string;
  poll?: GoPollPayload;
  editTargetId?: string;
  editEncrypted?: GoEditEncrypted;
};

/** ProtocolMessage.Type.MESSAGE_EDIT */
export const PROTOCOL_MESSAGE_EDIT = 14;
/** SecretEncryptedMessage.SecretEncType.MESSAGE_EDIT */
export const SECRET_ENC_TYPE_MESSAGE_EDIT = 2;
/** `Info.Edit` no webhook GO quando o evento é edição. */
export const INFO_EDIT_MENSAGEM = "1";

/** Lê `messageContextInfo.messageSecret` (base64) do objeto Message. */
export function extrairMessageSecretDeMessageObj(
  messageObj: Record<string, unknown>,
): string | null {
  const ctx = messageObj.messageContextInfo;
  if (!ctx || typeof ctx !== "object") return null;
  const secret = (ctx as { messageSecret?: unknown }).messageSecret;
  return typeof secret === "string" && secret.length > 0 ? secret : null;
}

/** Converte base64 ou array de bytes (JSON GO) em Uint8Array. */
export function bytesDeCampoGo(value: unknown): Uint8Array | null {
  if (value == null) return null;
  if (value instanceof Uint8Array) return value;
  if (typeof value === "string" && value.length > 0) {
    try {
      const fromBase64 = (Uint8Array as unknown as { fromBase64?: (s: string) => Uint8Array })
        .fromBase64;
      if (typeof fromBase64 === "function") return fromBase64(value);
      const binary = atob(value);
      const out = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i);
      return out;
    } catch {
      return null;
    }
  }
  if (Array.isArray(value) && value.every((n) => typeof n === "number")) {
    return Uint8Array.from(value as number[]);
  }
  return null;
}

/**
 * syncType do HistorySync (Evolution GO / whatsmeow).
 * Números = wire real; nomes batem com o payload observado no R2 (não com o enum protobuf literal).
 * Cap típico: {@link HISTORY_SYNC_CHUNK_MSG_CAP} mensagens por chunk.
 */
export const HISTORY_SYNC_TYPE = {
  /** Bootstrap inicial (~1k msgs); progress=100 NÃO encerra o sync completo. */
  INITIAL_BOOTSTRAP: 0,
  /**
   * Wire: `statusV3Messages` (status do WhatsApp).
   * Protobuf GO chama de PUSH_NAME — no corpus não traz pushnames.
   */
  STATUS_V3: 1,
  /** Histórico recente (~1 ano); progress=100 encerra o sync. */
  RECENT: 2,
  /** Histórico completo (anos); progress=100 NÃO encerra o sync (RECENT ainda vem). */
  FULL: 3,
  /**
   * Wire: `pushnames[]` no bootstrap; também usado em sync sob demanda por conversa.
   * Protobuf GO chama de ON_DEMAND.
   */
  PUSH_NAMES: 4,
  /** Metadata only — ignorar. */
  NON_BLOCKING_DATA: 5,
} as const;

/** Teto observado de mensagens por chunk no provedor. */
export const HISTORY_SYNC_CHUNK_MSG_CAP = 5000;

/** Status WMI numérico → rótulo string (HistorySync). */
export const WMI_STATUS = {
  0: "ERROR",
  1: "PENDING",
  2: "SERVER_ACK",
  3: "DELIVERY_ACK",
  4: "READ",
  5: "PLAYED",
} as const;

/** Normaliza `status` string ou código WMI numérico. */
export function normalizarStatusWmi(status: unknown): string | null {
  if (typeof status === "string") {
    const s = status.trim();
    return s.length > 0 ? s : null;
  }
  if (typeof status === "number" && Number.isFinite(status)) {
    const code = Math.trunc(status) as keyof typeof WMI_STATUS;
    return WMI_STATUS[code] ?? null;
  }
  return null;
}

export type GoPhoneLidMapping = {
  pnJid: string;
  lidJid: string;
};

export type GoHistorySyncChunk = {
  syncType: number;
  progress: number | null;
  chunkOrder: number | null;
  conversations: GoHistorySyncConversa[];
  temMensagens: boolean;
  /** Mapa LID → PN do chunk (`phoneNumberToLidMappings`). */
  phoneLidMappings: GoPhoneLidMapping[];
};

/** Rótulo curto da fase para UI/logs. */
export function rotuloHistorySyncType(syncType: number): string {
  switch (syncType) {
    case HISTORY_SYNC_TYPE.INITIAL_BOOTSTRAP:
      return "bootstrap";
    case HISTORY_SYNC_TYPE.STATUS_V3:
      return "status-v3";
    case HISTORY_SYNC_TYPE.RECENT:
      return "recente";
    case HISTORY_SYNC_TYPE.FULL:
      return "completo";
    case HISTORY_SYNC_TYPE.PUSH_NAMES:
      return "push-names";
    case HISTORY_SYNC_TYPE.NON_BLOCKING_DATA:
      return "metadata";
    default:
      return `tipo-${syncType}`;
  }
}

export type GoReceiptNormalizado = {
  chatJid: string;
  messageIds: string[];
  type: string;
  fromMe: boolean;
  state: string | null;
};

export type GoLabelAssociation = {
  jid: string;
  labelId: string;
  labeled: boolean;
};

export type GoButtonClick = {
  flowToken: string | null;
  idempotencyKey: string | null;
  name: string | null;
  type: string;
  timestamp: Date | null;
  flowResponse: GoFlowResponse | null;
};

export type GoPushName = {
  jid: string;
  jidAlt: string | null;
  oldPushName: string | null;
  newPushName: string;
  messageInfo: Record<string, unknown> | null;
};

export type GoLabelEdit = {
  labelId: string;
  name: string;
  color: number;
  deleted: boolean;
  orderIndex: number | null;
};

export type GoContactUpdate = {
  jid: string;
  fullName: string | null;
  lidJid: string | null;
};

export type GoPictureUpdate = {
  jid: string;
  pictureId: string | null;
  remove: boolean;
};

export type GoJoinedGroup = {
  jid: string;
  name: string | null;
  participantCount: number | null;
  type: string | null;
};

export type GoGroupInfo = {
  jid: string;
  name: string | null;
};

/** Resolve identificador de instância no payload GO. */
export function resolverInstanciaWebhookGo(payload: EvolutionGoWebhookPayload): {
  instanceName: string | null;
  instanceId: string | null;
} {
  return {
    instanceName: payload.instanceName ?? payload.instance ?? null,
    instanceId: payload.instanceId ?? null,
  };
}

/** Extrai telefone ou ID de grupo a partir de JID WhatsApp. */
export function jidParaTelefone(jid: string): string {
  const base = jid.split("@")[0] ?? jid;
  if (jid.endsWith("@g.us")) return base.replace(/\D/g, "") || base;
  return base.replace(/\D/g, "") || base;
}

/** JID completo para idExterno do contato. */
export function jidParaIdExterno(jid: string): string {
  return jid;
}

export function montarJidContato(telefone: string, idExterno: string | null | undefined): string {
  if (idExterno?.includes("@")) return idExterno;
  const digits = telefone.replace(/\D/g, "");
  if (idExterno?.includes("g.us") || telefone.length > 15) {
    return `${digits}@g.us`;
  }
  return `${digits}@s.whatsapp.net`;
}

function jidWhatsappNetDeAlt(info: Record<string, unknown>): string | null {
  for (const alt of [info.SenderAlt, info.RecipientAlt]) {
    const jid = typeof alt === "string" ? alt : "";
    if (jid.endsWith("@s.whatsapp.net")) return jid;
  }
  return null;
}

/**
 * Resolve idExterno canônico do contato org.
 * Prefere SenderAlt/RecipientAlt @s.whatsapp.net; senão @lid (ou Chat) do webhook.
 */
export function resolverIdExternoCanonicoGo(info: Record<string, unknown>): string {
  const altWhatsapp = jidWhatsappNetDeAlt(info);
  if (altWhatsapp) return altWhatsapp;

  const chat = String(info.Chat ?? "");
  if (chat) return chat;

  return String(info.Sender ?? "");
}

/** Telefone para exibição a partir dos campos Alt (ou Chat @s.whatsapp.net). */
export function telefoneExibicaoDeInfo(info: Record<string, unknown>): string | null {
  const altWhatsapp = jidWhatsappNetDeAlt(info);
  if (altWhatsapp) return jidParaTelefone(altWhatsapp);

  const chat = String(info.Chat ?? "");
  if (chat.endsWith("@s.whatsapp.net")) return jidParaTelefone(chat);

  return null;
}

function textoNaoVazio(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const t = value.trim();
  return t.length > 0 ? t : null;
}

function parsePollCreation(
  part:
    | {
        name?: string;
        options?: Array<{ optionName?: string }>;
        selectableOptionsCount?: number;
      }
    | undefined,
): GoCorpoParseado | null {
  if (!part) return null;
  const options =
    part.options
      ?.map((option) => option.optionName)
      .filter((nome): nome is string => typeof nome === "string" && nome.length > 0) ?? [];
  const name = part.name?.trim() || "[enquete]";
  const body = options.length > 0 ? `${name}: ${options.join(", ")}` : name;
  const poll: GoPollPayload = { name, options };
  if (typeof part.selectableOptionsCount === "number") {
    poll.selectableOptionsCount = part.selectableOptionsCount;
  }
  return { body, type: "poll", poll };
}

function textoTemplateMessage(part: Record<string, unknown>): string {
  const hydrated = part.hydratedTemplate as Record<string, unknown> | undefined;
  if (hydrated) {
    const hydratedContent = hydrated.hydratedContentText;
    const hydratedTitle = hydrated.hydratedTitleText;
    return textoNaoVazio(hydratedContent) ?? textoNaoVazio(hydratedTitle) ?? "[template]";
  }

  const format = part.Format as Record<string, unknown> | undefined;
  const interactive =
    (format?.InteractiveMessageTemplate as Record<string, unknown> | undefined)
      ?.InteractiveMessage ??
    (part.interactiveMessageTemplate as Record<string, unknown> | undefined)?.interactiveMessage;
  if (interactive && typeof interactive === "object") {
    const body =
      (interactive as { Body?: { Text?: string }; body?: { text?: string } }).Body?.Text ??
      (interactive as { body?: { text?: string } }).body?.text;
    if (textoNaoVazio(body)) return body!;
  }

  return "[template]";
}

function desaninharMensagem(
  messageObj: Record<string, unknown>,
  profundidade = 0,
): Record<string, unknown> {
  if (profundidade > 4) return messageObj;

  const wrappers = [
    "viewOnceMessage",
    "viewOnceMessageV2",
    "viewOnceMessageV2Extension",
    "ephemeralMessage",
    "documentWithCaptionMessage",
    "editedMessage",
    "associatedChildMessage",
    "lottieStickerMessage",
  ] as const;

  for (const key of wrappers) {
    const wrap = messageObj[key];
    if (!wrap || typeof wrap !== "object") continue;
    const inner = (wrap as { message?: unknown }).message;
    if (inner && typeof inner === "object") {
      return desaninharMensagem(inner as Record<string, unknown>, profundidade + 1);
    }
  }

  return messageObj;
}

function parseGoMessageBody(messageObj: Record<string, unknown>): GoCorpoParseado | null {
  const obj = desaninharMensagem(messageObj);

  if (obj.conversation !== undefined && obj.conversation !== null) {
    const body = String(obj.conversation);
    if (!body) return null;
    return { body, type: "text" };
  }
  if (obj.extendedTextMessage) {
    const text = (obj.extendedTextMessage as { text?: string }).text ?? "";
    return { body: String(text), type: "text" };
  }
  if (obj.imageMessage) {
    const part = obj.imageMessage as { caption?: string };
    return { body: part.caption ?? "[imagem]", type: "image" };
  }
  if (obj.audioMessage) {
    return { body: "[áudio]", type: "audio" };
  }
  if (obj.videoMessage) {
    const part = obj.videoMessage as { caption?: string };
    return { body: part.caption ?? "[vídeo]", type: "video" };
  }
  if (obj.ptvMessage) {
    return { body: "[vídeo]", type: "video" };
  }
  if (obj.documentMessage) {
    const part = obj.documentMessage as { fileName?: string; caption?: string };
    return { body: part.fileName ?? part.caption ?? "[documento]", type: "document" };
  }
  if (obj.locationMessage) {
    return { body: "[localização]", type: "location" };
  }
  if (obj.stickerMessage) {
    return { body: "[sticker]", type: "sticker" };
  }
  if (obj.reactionMessage) {
    const part = obj.reactionMessage as { text?: string };
    return { body: part.text ?? "[reação]", type: "reaction" };
  }
  const poll =
    parsePollCreation(obj.pollCreationMessageV3 as never) ??
    parsePollCreation(obj.pollCreationMessage as never);
  if (poll) return poll;

  if (obj.contactMessage) {
    const part = obj.contactMessage as { displayName?: string };
    return { body: part.displayName ?? "[contato]", type: "contacts" };
  }
  if (obj.contactsArrayMessage) {
    const part = obj.contactsArrayMessage as {
      displayName?: string;
      contacts?: Array<{ displayName?: string }>;
    };
    const nomes =
      part.contacts
        ?.map((c) => c.displayName)
        .filter(Boolean)
        .join(", ") ?? "";
    return {
      body: textoNaoVazio(part.displayName) ?? textoNaoVazio(nomes) ?? "[contatos]",
      type: "contacts",
    };
  }
  if (obj.eventMessage) {
    const part = obj.eventMessage as { name?: string };
    return { body: part.name ?? "[evento]", type: "event" };
  }
  if (obj.interactiveMessage) {
    const flow = parseInteractiveMessage(obj);
    return {
      body: flow ? formatInteractiveBody(flow) : "[interativo]",
      type: "interactive",
    };
  }
  if (obj.interactiveResponseMessage) {
    const response = parseInteractiveResponseMessage(obj);
    return {
      body: response ? formatInteractiveResponseBody(response) : "[resposta interativa]",
      type: "interactive",
    };
  }
  if (obj.albumMessage) {
    const part = obj.albumMessage as { caption?: string };
    return { body: textoNaoVazio(part.caption) ?? "[álbum]", type: "album" };
  }
  if (obj.buttonsMessage) {
    const part = obj.buttonsMessage as { contentText?: string; headerText?: string };
    return {
      body: textoNaoVazio(part.contentText) ?? textoNaoVazio(part.headerText) ?? "[botões]",
      type: "buttons",
    };
  }
  if (obj.buttonsResponseMessage) {
    const part = obj.buttonsResponseMessage as {
      selectedDisplayText?: string;
      Response?: { SelectedDisplayText?: string };
      selectedButtonID?: string;
    };
    return {
      body:
        textoNaoVazio(part.selectedDisplayText) ??
        textoNaoVazio(part.Response?.SelectedDisplayText) ??
        textoNaoVazio(part.selectedButtonID) ??
        "[resposta botão]",
      type: "buttons_response",
    };
  }
  if (obj.listMessage) {
    const part = obj.listMessage as { title?: string; description?: string };
    return {
      body: textoNaoVazio(part.title) ?? textoNaoVazio(part.description) ?? "[lista]",
      type: "list",
    };
  }
  if (obj.listResponseMessage) {
    const part = obj.listResponseMessage as {
      title?: string;
      singleSelectReply?: { selectedRowID?: string };
    };
    return {
      body:
        textoNaoVazio(part.title) ??
        textoNaoVazio(part.singleSelectReply?.selectedRowID) ??
        "[resposta lista]",
      type: "list_response",
    };
  }
  if (obj.templateMessage) {
    return {
      body: textoTemplateMessage(obj.templateMessage as Record<string, unknown>),
      type: "template",
    };
  }
  if (obj.templateButtonReplyMessage) {
    const part = obj.templateButtonReplyMessage as {
      selectedDisplayText?: string;
      selectedID?: string;
    };
    return {
      body:
        textoNaoVazio(part.selectedDisplayText) ??
        textoNaoVazio(part.selectedID) ??
        "[resposta template]",
      type: "template_reply",
    };
  }
  if (obj.groupInviteMessage) {
    const part = obj.groupInviteMessage as { groupName?: string; caption?: string };
    return {
      body: textoNaoVazio(part.groupName) ?? textoNaoVazio(part.caption) ?? "[convite grupo]",
      type: "group_invite",
    };
  }
  if (obj.protocolMessage) {
    const part = obj.protocolMessage as {
      type?: number | string;
      key?: { id?: string; ID?: string };
      editedMessage?: Record<string, unknown>;
    };
    const tipo =
      part.type === "MESSAGE_EDIT" || part.type === "ProtocolMessage_MESSAGE_EDIT"
        ? PROTOCOL_MESSAGE_EDIT
        : Number(part.type);
    if (tipo === 0) {
      const alvo = part.key?.id ?? part.key?.ID;
      return {
        body: textoNaoVazio(alvo) ?? "[mensagem apagada]",
        type: "revoke",
      };
    }
    if (tipo === PROTOCOL_MESSAGE_EDIT) {
      const alvo = part.key?.id ?? part.key?.ID;
      if (!alvo) return null;
      const editedRaw = part.editedMessage;
      const editedInner =
        editedRaw && typeof editedRaw === "object"
          ? ((editedRaw.message as Record<string, unknown> | undefined) ?? editedRaw)
          : null;
      if (!editedInner) return null;
      const corpoEditado = parseGoMessageBody(editedInner);
      if (!corpoEditado || !corpoEditado.body) return null;
      return {
        body: corpoEditado.body,
        type: "edit",
        editTargetId: alvo,
      };
    }
    return null;
  }
  if (obj.secretEncryptedMessage) {
    const part = obj.secretEncryptedMessage as {
      secretEncType?: number | string;
      targetMessageKey?: { id?: string; ID?: string };
      encIV?: unknown;
      encIv?: unknown;
      encPayload?: unknown;
    };
    const encType =
      part.secretEncType === "MESSAGE_EDIT" ||
      part.secretEncType === "SecretEncryptedMessage_MESSAGE_EDIT"
        ? SECRET_ENC_TYPE_MESSAGE_EDIT
        : Number(part.secretEncType);
    if (encType !== SECRET_ENC_TYPE_MESSAGE_EDIT) return null;
    const alvo = part.targetMessageKey?.id ?? part.targetMessageKey?.ID;
    if (!alvo) return null;
    const encIv = bytesDeCampoGo(part.encIV ?? part.encIv);
    const encPayload = bytesDeCampoGo(part.encPayload);
    if (!encIv || !encPayload || encIv.length === 0 || encPayload.length === 0) return null;
    return {
      body: "",
      type: "edit_encrypted",
      editTargetId: alvo,
      editEncrypted: { editTargetId: alvo, encIv, encPayload },
    };
  }
  if (obj.placeholderMessage) {
    return { body: "[placeholder]", type: "placeholder" };
  }
  return null;
}

function timestampFromGo(value: unknown): Date | null {
  if (value === null || value === undefined) return null;
  if (typeof value === "string") {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }
  if (typeof value === "number") {
    const ms = value > 1_000_000_000_000 ? value : value * 1000;
    return new Date(ms);
  }
  return null;
}

/** Normaliza evento Message ou SendMessage (formato GO). */
/** JID de canal/newsletter — não vira conversa no painel. */
export function jidEhNewsletter(jid: string): boolean {
  return jid.endsWith("@newsletter");
}

/** Extrai `contextInfo` do primeiro part de mensagem que o tiver. */
export function extrairContextInfoDeMessageObj(
  messageObj: Record<string, unknown>,
): GoMessageContextInfo | null {
  for (const value of Object.values(messageObj)) {
    if (!value || typeof value !== "object") continue;
    const part = value as Record<string, unknown>;
    const raw = part.contextInfo;
    if (!raw || typeof raw !== "object") continue;
    const ci = raw as Record<string, unknown>;

    const mentionedRaw = ci.mentionedJID ?? ci.mentionedJid;
    const mentionedJids = Array.isArray(mentionedRaw)
      ? mentionedRaw.map((j) => String(j).trim()).filter((j) => j.length > 0)
      : undefined;

    const quotedStanzaId = textoNaoVazio(ci.stanzaID) ?? textoNaoVazio(ci.stanzaId) ?? undefined;
    const quotedParticipant = textoNaoVazio(ci.participant) ?? undefined;
    const quotedType =
      typeof ci.quotedType === "number"
        ? ci.quotedType
        : typeof ci.quotedType === "string" && ci.quotedType
          ? Number(ci.quotedType)
          : null;
    const isForwarded = Boolean(ci.isForwarded);
    const forwardingScore =
      typeof ci.forwardingScore === "number"
        ? ci.forwardingScore
        : typeof ci.forwardingScore === "string" && ci.forwardingScore
          ? Number(ci.forwardingScore)
          : null;

    const out: GoMessageContextInfo = {};
    if (mentionedJids?.length) out.mentionedJids = mentionedJids;
    if (quotedStanzaId) out.quotedStanzaId = quotedStanzaId;
    if (quotedParticipant) out.quotedParticipant = quotedParticipant;
    if (quotedType !== null && Number.isFinite(quotedType)) out.quotedType = quotedType;
    if (isForwarded) out.isForwarded = true;
    if (forwardingScore !== null && Number.isFinite(forwardingScore)) {
      out.forwardingScore = forwardingScore;
    }
    return Object.keys(out).length > 0 ? out : null;
  }
  return null;
}

/** Normaliza `groupData` embutido em eventos Message. */
export function parseGoGroupData(raw: unknown): GoGroupData | null {
  if (!raw || typeof raw !== "object") return null;
  const data = raw as Record<string, unknown>;
  const jid = String(data.JID ?? data.jid ?? "").trim();
  if (!jid.endsWith("@g.us")) return null;

  const participants: GoGroupData["participants"] = [];
  const rawParts = data.Participants ?? data.participants;
  if (Array.isArray(rawParts)) {
    for (const item of rawParts) {
      if (!item || typeof item !== "object") continue;
      const row = item as Record<string, unknown>;
      const lidJid = String(row.LID ?? row.lidJid ?? row.JID ?? "").trim();
      const pnJid = String(row.PhoneNumber ?? row.phoneNumber ?? "").trim();
      if (!lidJid.endsWith("@lid")) continue;
      participants.push({
        lidJid,
        pnJid: pnJid.endsWith("@s.whatsapp.net") ? pnJid : null,
      });
    }
  }

  return {
    jid,
    name: textoNaoVazio(data.Name) ?? textoNaoVazio(data.name),
    participants,
  };
}

export function parseGoMessageEvent(data: Record<string, unknown>): GoMensagemNormalizada | null {
  const info = data.Info as Record<string, unknown> | undefined;
  const messageObj = data.Message as Record<string, unknown> | undefined;
  if (!info || !messageObj) return null;

  const chatJid = String(info.Chat ?? info.Sender ?? "");
  const messageId = String(info.ID ?? "");
  if (!chatJid || !messageId) return null;
  if (jidEhNewsletter(chatJid)) return null;
  const senderRaw = typeof info.Sender === "string" ? info.Sender : "";
  if (senderRaw && jidEhNewsletter(senderRaw)) return null;

  const parsed = parseGoMessageBody(messageObj);
  if (!parsed) return null;

  const isGroup = Boolean(info.IsGroup) || chatJid.endsWith("@g.us");
  const messageSecret = extrairMessageSecretDeMessageObj(messageObj) ?? undefined;
  const senderJid = typeof info.Sender === "string" && info.Sender ? info.Sender : undefined;
  const senderJidAlt =
    (typeof info.SenderAlt === "string" && info.SenderAlt ? info.SenderAlt : null) ??
    (typeof info.RecipientAlt === "string" && info.RecipientAlt ? info.RecipientAlt : null) ??
    undefined;
  const contextInfo = extrairContextInfoDeMessageObj(messageObj) ?? undefined;
  const groupData = parseGoGroupData(data.groupData ?? data.GroupData) ?? undefined;

  let type = parsed.type;
  let body = parsed.body;
  let editTargetId = parsed.editTargetId;
  let editEncrypted = parsed.editEncrypted;

  // Info.Edit=1 marca edição mesmo quando IsEdit=false (Evolution GO).
  if (
    String(info.Edit ?? "") === INFO_EDIT_MENSAGEM &&
    type !== "edit" &&
    type !== "edit_encrypted"
  ) {
    const bot = info.MsgBotInfo as { EditTargetID?: string } | undefined;
    const meta = info.MsgMetaInfo as { TargetID?: string } | undefined;
    const alvo = textoNaoVazio(bot?.EditTargetID) ?? textoNaoVazio(meta?.TargetID) ?? editTargetId;
    if (alvo && body) {
      type = "edit";
      editTargetId = alvo;
    }
  }

  return {
    chatJid,
    messageId,
    fromMe: Boolean(info.IsFromMe),
    pushName: typeof info.PushName === "string" ? info.PushName : null,
    body,
    type,
    timestamp: timestampFromGo(info.Timestamp),
    isGroup,
    messageObj,
    ...(parsed.poll ? { poll: parsed.poll } : {}),
    ...(editTargetId ? { editTargetId } : {}),
    ...(editEncrypted ? { editEncrypted } : {}),
    ...(messageSecret ? { messageSecret } : {}),
    ...(senderJid ? { senderJid } : {}),
    ...(senderJidAlt ? { senderJidAlt } : {}),
    ...(contextInfo ? { contextInfo } : {}),
    ...(groupData ? { groupData } : {}),
  };
}

/** Normaliza mensagem no formato HistorySync (Baileys-like). */
function parseHistorySyncMessage(
  wrapper: Record<string, unknown>,
  fallbackChatJid: string,
): GoHistorySyncConversa["messages"][number] | null {
  const inner = wrapper.message as Record<string, unknown> | undefined;
  if (!inner) return null;

  const key = inner.key as Record<string, unknown> | undefined;
  const messageObj = inner.message as Record<string, unknown> | undefined;
  if (!key || !messageObj) return null;

  const chatJid = String(key.remoteJID ?? key.remoteJid ?? fallbackChatJid);
  const messageId = String(key.id ?? key.ID ?? "");
  if (!messageId) return null;

  const parsed = parseGoMessageBody(messageObj);
  if (!parsed) return null;
  // Edições/envelopes criptografados não viram linha no history sync.
  if (parsed.type === "edit" || parsed.type === "edit_encrypted") return null;

  return {
    messageId,
    chatJid,
    fromMe: Boolean(key.fromMe),
    body: parsed.body,
    type: parsed.type,
    timestamp: timestampFromGo(inner.messageTimestamp),
    status: normalizarStatusWmi(inner.status),
    messageObj,
    ...(parsed.poll ? { poll: parsed.poll } : {}),
  };
}

function parsePhoneLidMappings(raw: unknown): GoPhoneLidMapping[] {
  if (!Array.isArray(raw)) return [];
  const out: GoPhoneLidMapping[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const row = item as Record<string, unknown>;
    const pnJid = String(row.pnJID ?? row.pnJid ?? "");
    const lidJid = String(row.lidJID ?? row.lidJid ?? "");
    if (!pnJid.endsWith("@s.whatsapp.net") || !lidJid.endsWith("@lid")) continue;
    out.push({ pnJid, lidJid });
  }
  return out;
}

/** Monta mapa lidJid → pnJid a partir dos mappings do chunk. */
export function mapaLidParaPn(mappings: GoPhoneLidMapping[]): Map<string, string> {
  const mapa = new Map<string, string>();
  for (const m of mappings) mapa.set(m.lidJid, m.pnJid);
  return mapa;
}

/**
 * Resolve identidade de conversa no HistorySync.
 * Prefere PN via `phoneNumberToLidMappings` quando o JID é `@lid`.
 */
export function resolverJidHistoricoSync(
  jid: string,
  lidParaPn: ReadonlyMap<string, string>,
): { idExternoLinha: string; idExternoCanonico: string; phone: string } {
  const idExternoLinha = jidParaIdExterno(jid);
  if (jid.endsWith("@g.us")) {
    return { idExternoLinha, idExternoCanonico: jid, phone: jidParaTelefone(jid) };
  }
  if (jid.endsWith("@lid")) {
    const pn = lidParaPn.get(jid);
    if (pn) {
      return {
        idExternoLinha,
        idExternoCanonico: pn,
        phone: jidParaTelefone(pn),
      };
    }
    return { idExternoLinha, idExternoCanonico: jid, phone: jidParaTelefone(jid) };
  }
  if (jid.endsWith("@s.whatsapp.net")) {
    return { idExternoLinha, idExternoCanonico: jid, phone: jidParaTelefone(jid) };
  }
  return {
    idExternoLinha,
    idExternoCanonico: `${jidParaTelefone(jid)}@s.whatsapp.net`,
    phone: jidParaTelefone(jid),
  };
}

/** Normaliza chunk HistorySync. syncType 5 e chunks sem conversas retornam temMensagens=false. */
export function parseGoHistorySyncChunk(data: Record<string, unknown>): GoHistorySyncChunk {
  const inner = (data.Data ?? data) as Record<string, unknown>;
  const syncType = Number(inner.syncType ?? -1);
  const progress = inner.progress !== undefined ? Number(inner.progress) : null;
  const chunkOrder = inner.chunkOrder !== undefined ? Number(inner.chunkOrder) : null;
  const rawConversations = (inner.conversations as Array<Record<string, unknown>>) ?? [];
  const phoneLidMappings = parsePhoneLidMappings(inner.phoneNumberToLidMappings);

  const conversations: GoHistorySyncConversa[] = [];
  for (const conv of rawConversations) {
    const jid = String(conv.ID ?? "");
    if (!jid) continue;

    const messages: GoHistorySyncConversa["messages"] = [];
    for (const wrapper of (conv.messages as Array<Record<string, unknown>>) ?? []) {
      const msg = parseHistorySyncMessage(wrapper, jid);
      if (msg) messages.push(msg);
    }

    conversations.push({
      jid,
      nome: typeof conv.name === "string" ? conv.name : null,
      unreadCount: Number(conv.unreadCount ?? 0),
      messages,
    });
  }

  const temMensagens = conversations.some((c) => c.messages.length > 0);

  return {
    syncType,
    progress,
    chunkOrder,
    conversations,
    temMensagens,
    phoneLidMappings,
  };
}

/** Indica se o chunk deve ser ignorado (metadata only). */
export function deveIgnorarHistorySyncChunk(chunk: GoHistorySyncChunk): boolean {
  if (chunk.syncType === HISTORY_SYNC_TYPE.NON_BLOCKING_DATA) return true;
  return !chunk.temMensagens;
}

/**
 * Indica fim do sync completo: só a fase RECENT (syncType 2) com progress=100.
 * Bootstrap (0) e FULL (3) também chegam a 100 — não marcar completed neles
 * (ainda chegam dezenas de milhares de msgs depois). Contas que nunca terminam
 * RECENT dependem do idle no worker (`concluirHistoricosSyncOciosos`).
 */
export function historySyncConcluido(chunk: GoHistorySyncChunk): boolean {
  return chunk.syncType === HISTORY_SYNC_TYPE.RECENT && chunk.progress === 100;
}

export function parseGoReceipt(
  data: Record<string, unknown>,
  state?: string,
): GoReceiptNormalizado | null {
  const chatJid = String(data.Chat ?? "");
  const messageIds = ((data.MessageIDs as string[] | undefined) ?? [])
    .map((id) => String(id).trim())
    .filter((id) => id.length > 0);
  if (!chatJid || messageIds.length === 0) return null;

  return {
    chatJid,
    messageIds,
    type: String(data.Type ?? "").toLowerCase(),
    fromMe: Boolean(data.IsFromMe),
    state: state ?? null,
  };
}

export function parseGoLabelAssociation(data: Record<string, unknown>): GoLabelAssociation | null {
  const jid = String(data.JID ?? "");
  const labelId = String(data.LabelID ?? "");
  if (!jid || !labelId) return null;

  const action = data.Action as { labeled?: boolean } | undefined;
  return {
    jid,
    labelId,
    labeled: Boolean(action?.labeled),
  };
}

/** Normaliza evento ButtonClick (resposta de flow nativo). */
export function parseGoButtonClick(data: Record<string, unknown>): GoButtonClick | null {
  const extraData = data.extraData as Record<string, unknown> | undefined;
  const type = String(data.type ?? extraData?.type ?? "");
  if (!type) return null;

  const flowResponse = parseFlowResponseDeExtraData(extraData);
  const flowToken = flowResponse?.flowToken ?? null;

  return {
    flowToken,
    idempotencyKey: flowToken,
    name: typeof extraData?.name === "string" ? extraData.name : null,
    type,
    timestamp: timestampFromGo(data.timestamp),
    flowResponse,
  };
}

/** Normaliza evento PushName (atualização de nome do contato). */
export function parseGoPushName(data: Record<string, unknown>): GoPushName | null {
  const jid = String(data.JID ?? "");
  const newPushName = typeof data.NewPushName === "string" ? data.NewPushName : "";
  if (!jid || !newPushName) return null;

  const messageInfo = data.Message as Record<string, unknown> | undefined;

  return {
    jid,
    jidAlt: typeof data.JIDAlt === "string" && data.JIDAlt ? data.JIDAlt : null,
    oldPushName: typeof data.OldPushName === "string" && data.OldPushName ? data.OldPushName : null,
    newPushName,
    messageInfo: messageInfo ?? null,
  };
}

export function parseGoPairSuccess(data: Record<string, unknown>): "open" | "close" | null {
  const status = String(data.status ?? "").toLowerCase();
  if (status === "open") return "open";
  if (status === "close") return "close";
  return null;
}

/** QRTimeout: data vazia — trata como desconexão/timeout do QR. */
export function parseGoQrTimeout(_data?: Record<string, unknown>): "close" {
  return "close";
}

/** Normaliza LabelEdit (criar/atualizar/remover etiqueta no WhatsApp). */
export function parseGoLabelEdit(data: Record<string, unknown>): GoLabelEdit | null {
  const labelId = String(data.LabelID ?? "").trim();
  if (!labelId) return null;
  const action = (data.Action as Record<string, unknown> | undefined) ?? {};
  const name = textoNaoVazio(action.name) ?? `Etiqueta ${labelId}`;
  return {
    labelId,
    name,
    color: typeof action.color === "number" ? action.color : Number(action.color ?? 0) || 0,
    deleted: Boolean(action.deleted),
    orderIndex: typeof action.orderIndex === "number" ? action.orderIndex : null,
  };
}

/** Normaliza Contact (atualização de nome / LID). */
export function parseGoContact(data: Record<string, unknown>): GoContactUpdate | null {
  const jid = String(data.JID ?? "").trim();
  if (!jid) return null;
  const action = (data.Action as Record<string, unknown> | undefined) ?? {};
  const fullNameRaw = typeof action.fullName === "string" ? action.fullName : null;
  const fullName = fullNameRaw
    ? fullNameRaw.replace(/[\u200e\u200f\u202a-\u202e]/g, "").trim() || null
    : null;
  const lidJid =
    typeof action.lidJID === "string" && action.lidJID
      ? action.lidJID
      : typeof action.lidJid === "string" && action.lidJid
        ? action.lidJid
        : null;
  return { jid, fullName, lidJid };
}

/** Normaliza Picture (avatar) — tipagem apenas; schema sem campo de foto. */
export function parseGoPicture(data: Record<string, unknown>): GoPictureUpdate | null {
  const jid = String(data.JID ?? "").trim();
  if (!jid) return null;
  const pictureId = textoNaoVazio(data.PictureID);
  return {
    jid,
    pictureId,
    remove: Boolean(data.Remove),
  };
}

/** Normaliza JoinedGroup. */
export function parseGoJoinedGroup(data: Record<string, unknown>): GoJoinedGroup | null {
  const jid = String(data.JID ?? "").trim();
  if (!jid.endsWith("@g.us")) return null;
  const participants = data.Participants;
  return {
    jid,
    name: textoNaoVazio(data.Name),
    participantCount: Array.isArray(participants) ? participants.length : null,
    type: textoNaoVazio(data.Type),
  };
}

/** Normaliza GroupInfo (deltas; hoje usamos Name). */
export function parseGoGroupInfo(data: Record<string, unknown>): GoGroupInfo | null {
  const jid = String(data.JID ?? "").trim();
  if (!jid.endsWith("@g.us")) return null;
  const nameObj = data.Name as { Name?: string; name?: string } | string | null | undefined;
  let name: string | null = null;
  if (typeof nameObj === "string") name = textoNaoVazio(nameObj);
  else if (nameObj && typeof nameObj === "object") {
    name = textoNaoVazio(nameObj.Name) ?? textoNaoVazio(nameObj.name);
  }
  return { jid, name };
}

/** Receipt indica leitura (inbound ou outbound). */
export function receiptIndicaLeitura(receipt: GoReceiptNormalizado): boolean {
  const type = receipt.type.toLowerCase();
  const state = (receipt.state ?? "").toLowerCase();
  return (
    type.includes("read") ||
    type.includes("played") ||
    state.includes("read") ||
    state.includes("played")
  );
}

/** Receipt indica entrega ao dispositivo (`state=Delivered`, Type vazio no corpus). */
export function receiptIndicaEntrega(receipt: GoReceiptNormalizado): boolean {
  if (receiptIndicaLeitura(receipt)) return false;
  const type = receipt.type.toLowerCase();
  const state = (receipt.state ?? "").toLowerCase();
  return type.includes("delivered") || state.includes("delivered");
}
