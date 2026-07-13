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
  }>;
};

/**
 * syncType do HistorySync (whatsmeow / Evolution GO).
 * O provedor envia várias fases em sequência; cada uma tem seu próprio progress 0→100.
 * Cap típico: {@link HISTORY_SYNC_CHUNK_MSG_CAP} mensagens por chunk.
 */
export const HISTORY_SYNC_TYPE = {
  /** Bootstrap inicial (~1k msgs); progress=100 NÃO encerra o sync completo. */
  INITIAL_BOOTSTRAP: 0,
  PUSH_NAME: 1,
  /** Histórico recente (~1 ano); última fase útil típica — progress=100 encerra o sync. */
  RECENT: 2,
  /** Histórico completo (anos); progress=100 NÃO encerra o sync (RECENT ainda vem). */
  FULL: 3,
  ON_DEMAND: 4,
  /** Metadata only — ignorar. */
  NON_BLOCKING_DATA: 5,
} as const;

/** Teto observado de mensagens por chunk no provedor. */
export const HISTORY_SYNC_CHUNK_MSG_CAP = 5000;

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
    case HISTORY_SYNC_TYPE.PUSH_NAME:
      return "push-name";
    case HISTORY_SYNC_TYPE.RECENT:
      return "recente";
    case HISTORY_SYNC_TYPE.FULL:
      return "completo";
    case HISTORY_SYNC_TYPE.ON_DEMAND:
      return "on-demand";
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

function parseGoMessageBody(
  messageObj: Record<string, unknown>,
): { body: string; type: string } | null {
  if (messageObj.conversation) {
    return { body: String(messageObj.conversation), type: "text" };
  }
  if (messageObj.extendedTextMessage) {
    const text = (messageObj.extendedTextMessage as { text?: string }).text ?? "";
    return { body: String(text), type: "text" };
  }
  if (messageObj.imageMessage) {
    const part = messageObj.imageMessage as { caption?: string };
    return { body: part.caption ?? "[imagem]", type: "image" };
  }
  if (messageObj.audioMessage) {
    return { body: "[áudio]", type: "audio" };
  }
  if (messageObj.videoMessage) {
    const part = messageObj.videoMessage as { caption?: string };
    return { body: part.caption ?? "[vídeo]", type: "video" };
  }
  if (messageObj.documentMessage) {
    const part = messageObj.documentMessage as { fileName?: string; caption?: string };
    return { body: part.fileName ?? part.caption ?? "[documento]", type: "document" };
  }
  if (messageObj.locationMessage) {
    return { body: "[localização]", type: "location" };
  }
  if (messageObj.stickerMessage) {
    return { body: "[sticker]", type: "sticker" };
  }
  if (messageObj.reactionMessage) {
    const part = messageObj.reactionMessage as { text?: string };
    return { body: part.text ?? "[reação]", type: "reaction" };
  }
  if (messageObj.pollCreationMessageV3) {
    const part = messageObj.pollCreationMessageV3 as {
      name?: string;
      options?: Array<{ optionName?: string }>;
    };
    const options = part.options?.map((option) => option.optionName).filter(Boolean) ?? [];
    const body =
      options.length > 0
        ? `${part.name ?? "[enquete]"}: ${options.join(", ")}`
        : (part.name ?? "[enquete]");
    return { body, type: "poll" };
  }
  if (messageObj.contactMessage) {
    const part = messageObj.contactMessage as { displayName?: string };
    return { body: part.displayName ?? "[contato]", type: "contacts" };
  }
  if (messageObj.eventMessage) {
    const part = messageObj.eventMessage as { name?: string };
    return { body: part.name ?? "[evento]", type: "event" };
  }
  if (messageObj.interactiveMessage) {
    const flow = parseInteractiveMessage(messageObj);
    return {
      body: flow ? formatInteractiveBody(flow) : "[interativo]",
      type: "interactive",
    };
  }
  if (messageObj.interactiveResponseMessage) {
    const response = parseInteractiveResponseMessage(messageObj);
    return {
      body: response ? formatInteractiveResponseBody(response) : "[resposta interativa]",
      type: "interactive",
    };
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
export function parseGoMessageEvent(data: Record<string, unknown>): GoMensagemNormalizada | null {
  const info = data.Info as Record<string, unknown> | undefined;
  const messageObj = data.Message as Record<string, unknown> | undefined;
  if (!info || !messageObj) return null;

  const chatJid = String(info.Chat ?? info.Sender ?? "");
  const messageId = String(info.ID ?? "");
  if (!chatJid || !messageId) return null;

  const parsed = parseGoMessageBody(messageObj);
  if (!parsed) return null;

  const isGroup = Boolean(info.IsGroup) || chatJid.endsWith("@g.us");

  return {
    chatJid,
    messageId,
    fromMe: Boolean(info.IsFromMe),
    pushName: typeof info.PushName === "string" ? info.PushName : null,
    body: parsed.body,
    type: parsed.type,
    timestamp: timestampFromGo(info.Timestamp),
    isGroup,
    messageObj,
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

  return {
    messageId,
    chatJid,
    fromMe: Boolean(key.fromMe),
    body: parsed.body,
    type: parsed.type,
    timestamp: timestampFromGo(inner.messageTimestamp),
    status: typeof inner.status === "string" ? inner.status : null,
    messageObj,
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
