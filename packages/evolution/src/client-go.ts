import type { EvolutionCredentials, EvolutionGoInstanceContext } from "./credentials";
import type {
  EvolutionConnectParams,
  EvolutionGoConnectResponse,
  EvolutionGoCreateParams,
  EvolutionGoCreateResponse,
} from "./instance-types";
import type { EvolutionQrResponse, EvolutionSendResponse } from "./types";

export type { EvolutionGoStatusResponse } from "./connection-state";
export type {
  EvolutionConnectParams,
  EvolutionGoApiError,
  EvolutionGoApiSuccess,
  EvolutionGoConnectData,
  EvolutionGoConnectResponse,
  EvolutionGoCreateInstanceData,
  EvolutionGoCreateParams,
  EvolutionGoCreateResponse,
} from "./instance-types";

export type EvolutionGoDownloadMediaResult = {
  base64: string;
  mimetype?: string;
  timestamp?: string;
};

export type EvolutionGoDownloadMediaCodigo = "forbidden" | "unauthorized" | "failed";

/** Erro tipado de `/message/downloadmedia` (401 / 403-via-500 / genérico). */
export class EvolutionGoDownloadMediaError extends Error {
  readonly status: number;
  readonly codigo: EvolutionGoDownloadMediaCodigo;
  readonly body: unknown;

  constructor(params: {
    status: number;
    codigo: EvolutionGoDownloadMediaCodigo;
    body: unknown;
    message?: string;
  }) {
    super(params.message ?? `Evolution downloadmedia error (${params.status})`);
    this.name = "EvolutionGoDownloadMediaError";
    this.status = params.status;
    this.codigo = params.codigo;
    this.body = params.body;
  }
}

/** Classifica falha a partir do status HTTP e body do GO. */
export function classificarErroDownloadMedia(
  status: number,
  body: unknown,
): EvolutionGoDownloadMediaCodigo {
  const texto =
    body && typeof body === "object" && "error" in body
      ? String((body as { error?: unknown }).error ?? "")
      : typeof body === "string"
        ? body
        : JSON.stringify(body ?? "");
  if (status === 401 || /not authorized/i.test(texto)) return "unauthorized";
  if (status === 403 || /\b403\b/.test(texto) || /Failed to download/i.test(texto)) {
    return "forbidden";
  }
  return "failed";
}

/** Unwrap `{ data: { base64 } }` ou shapes flat. */
export function normalizarDownloadMediaBody(body: unknown): EvolutionGoDownloadMediaResult | null {
  if (!body || typeof body !== "object") return null;
  const row = body as Record<string, unknown>;
  const data =
    row.data && typeof row.data === "object" ? (row.data as Record<string, unknown>) : null;
  const b64 =
    (typeof row.base64 === "string" ? row.base64 : null) ??
    (typeof data?.base64 === "string" ? data.base64 : null) ??
    (typeof row.data === "string" ? row.data : null);
  if (!b64?.trim()) return null;

  let mimetype =
    (typeof row.mimetype === "string" ? row.mimetype : undefined) ??
    (typeof data?.mimetype === "string" ? data.mimetype : undefined);
  const dataUrl = /^data:([^;]+);base64,/i.exec(b64);
  if (!mimetype && dataUrl?.[1]) mimetype = dataUrl[1];

  const timestamp =
    (typeof data?.timestamp === "string" ? data.timestamp : undefined) ??
    (typeof row.timestamp === "string" ? row.timestamp : undefined);

  return { base64: b64, mimetype, timestamp };
}

export type EvolutionGoRequestLogEntry = {
  /** Ação semântica (ex.: instance_qr, send_text). */
  tipo: string;
  method: string;
  /** URL completa da requisição. */
  url: string;
  path: string;
  status: number | null;
  durationMs: number;
  requestBody?: unknown;
  responseBody?: unknown;
  error?: string;
};

export type EvolutionGoLogSink = {
  onRequest: (entry: EvolutionGoRequestLogEntry) => void | Promise<void>;
};

export type EvolutionGoClientOptions = {
  log?: EvolutionGoLogSink;
  meta?: Record<string, string>;
};

import type { EvolutionGoStatusResponse } from "./connection-state";

type Quoted = { messageId: string; participant?: string };

function quotedField(quoted?: Quoted) {
  return quoted ? { quoted: { messageId: quoted.messageId, participant: quoted.participant } } : {};
}

function tryParseJsonBody(texto: string): unknown {
  try {
    return JSON.parse(texto) as unknown;
  } catch {
    return { raw: texto };
  }
}

/**
 * Client Evolution GO (whatsmeow).
 * Spec oficial: `packages/evolution/doc-oficial.json`
 *
 * Auth (padrão Evolution API, mesmo modelo do GO):
 * - Header `apikey` com GLOBAL_API_KEY em `/instance/create` e `/instance/connect`
 * - Header `apikey` com token da instância em `/send/*`, `/instance/qr`, `/instance/status`, `/message/*`
 *
 * Webhook: configurado via `webhookUrl` em `connect`. Payload whatsmeow compatível com
 * `event` + `instance`/`instanceId` + `data` (validar em staging).
 */
export function createEvolutionGoClient(
  credentials: EvolutionCredentials,
  instanceCtx?: EvolutionGoInstanceContext,
  options?: EvolutionGoClientOptions,
) {
  const base = credentials.baseUrl.replace(/\/$/, "");
  const logSink = options?.log;

  function headers(useInstanceToken: boolean) {
    const key =
      useInstanceToken && instanceCtx?.instanceToken
        ? instanceCtx.instanceToken
        : credentials.apiKey;
    return {
      "Content-Type": "application/json",
      apikey: key,
    };
  }

  function emitLog(entry: EvolutionGoRequestLogEntry) {
    if (!logSink) return;
    void Promise.resolve(logSink.onRequest(entry)).catch(() => {
      // sink não deve falhar a requisição
    });
  }

  async function request<T>(
    tipo: string,
    method: string,
    path: string,
    body?: unknown,
    useInstanceToken = true,
    timeoutMs?: number,
  ): Promise<T> {
    const started = Date.now();
    const url = `${base}${path}`;
    let status: number | null = null;
    let responseBody: unknown;
    let errorText: string | undefined;
    const controller = timeoutMs ? new AbortController() : undefined;
    const timer =
      timeoutMs && controller ? setTimeout(() => controller.abort(), timeoutMs) : undefined;

    try {
      const res = await fetch(url, {
        method,
        headers: headers(useInstanceToken),
        body: body !== undefined ? JSON.stringify(body) : undefined,
        signal: controller?.signal,
      });
      status = res.status;
      if (!res.ok) {
        errorText = await res.text();
        responseBody = tryParseJsonBody(errorText);
        throw new Error(`Evolution GO error (${res.status}): ${errorText}`);
      }
      responseBody = await res.json();
      return responseBody as T;
    } catch (err) {
      if (!errorText) {
        errorText = err instanceof Error ? err.message : String(err);
      }
      throw err;
    } finally {
      if (timer) clearTimeout(timer);
      emitLog({
        tipo,
        method,
        url,
        path,
        status,
        durationMs: Date.now() - started,
        requestBody: body,
        responseBody,
        error: errorText,
      });
    }
  }

  return {
    createInstance(params: EvolutionGoCreateParams) {
      return request<EvolutionGoCreateResponse>(
        "instance_create",
        "POST",
        "/instance/create",
        {
          name: params.name,
          instanceId: params.instanceId,
          token: params.token,
          advancedSettings: params.advancedSettings,
          proxy: params.proxy,
        },
        false,
      );
    },

    connect(params: EvolutionConnectParams) {
      return request<EvolutionGoConnectResponse>(
        "instance_connect",
        "POST",
        "/instance/connect",
        {
          webhookUrl: params.webhookUrl,
          phone: params.phone,
          subscribe: params.subscribe,
          immediate: params.immediate,
          rabbitmqEnable: params.rabbitmqEnable,
          websocketEnable: params.websocketEnable,
          natsEnable: params.natsEnable,
        },
        Boolean(instanceCtx?.instanceToken),
      );
    },

    pair(phone: string) {
      return request("instance_pair", "POST", "/instance/pair", { phone }, false);
    },

    getQrCode() {
      return request<EvolutionQrResponse>(
        "instance_qr",
        "GET",
        "/instance/qr",
        undefined,
        true,
        20_000,
      );
    },

    getStatus() {
      return request<EvolutionGoStatusResponse>("instance_status", "GET", "/instance/status");
    },

    disconnect() {
      return request(
        "instance_disconnect",
        "POST",
        "/instance/disconnect",
        undefined,
        Boolean(instanceCtx?.instanceToken),
      );
    },

    deleteInstance(instanceId: string) {
      return request(
        "instance_delete",
        "DELETE",
        `/instance/delete/${encodeURIComponent(instanceId)}`,
        undefined,
        false,
      );
    },

    sendText(number: string, text: string, quoted?: Quoted) {
      return request<EvolutionSendResponse>("send_text", "POST", "/send/text", {
        number,
        text,
        ...quotedField(quoted),
      });
    },

    sendMedia(
      number: string,
      type: "image" | "video" | "audio" | "document",
      url: string,
      caption?: string,
      filename?: string,
      quoted?: Quoted,
    ) {
      return request<EvolutionSendResponse>("send_media", "POST", "/send/media", {
        number,
        type,
        url,
        caption,
        filename,
        ...quotedField(quoted),
      });
    },

    sendSticker(number: string, url: string, quoted?: Quoted) {
      return request<EvolutionSendResponse>("send_sticker", "POST", "/send/sticker", {
        number,
        url,
        ...quotedField(quoted),
      });
    },

    sendLocation(
      number: string,
      latitude: number,
      longitude: number,
      name?: string,
      address?: string,
      quoted?: Quoted,
    ) {
      return request<EvolutionSendResponse>("send_location", "POST", "/send/location", {
        number,
        latitude,
        longitude,
        name,
        address,
        ...quotedField(quoted),
      });
    },

    sendContact(number: string, vcard: unknown, quoted?: Quoted) {
      return request<EvolutionSendResponse>("send_contact", "POST", "/send/contact", {
        number,
        vcard,
        ...quotedField(quoted),
      });
    },

    sendButton(payload: unknown) {
      return request<EvolutionSendResponse>("send_button", "POST", "/send/button", payload);
    },

    sendList(payload: unknown) {
      return request<EvolutionSendResponse>("send_list", "POST", "/send/list", payload);
    },

    sendCarousel(payload: unknown) {
      return request<EvolutionSendResponse>("send_carousel", "POST", "/send/carousel", payload);
    },

    sendPoll(payload: unknown) {
      return request<EvolutionSendResponse>("send_poll", "POST", "/send/poll", payload);
    },

    sendLink(payload: unknown) {
      return request<EvolutionSendResponse>("send_link", "POST", "/send/link", payload);
    },

    markRead(number: string, ids: string[]) {
      return request("message_markread", "POST", "/message/markread", { number, id: ids });
    },

    react(number: string, messageId: string, emoji: string, fromMe = false) {
      return request<EvolutionSendResponse>("message_react", "POST", "/message/react", {
        number,
        messageId,
        emoji,
        fromMe,
      });
    },

    downloadMedia(message: unknown) {
      return (async (): Promise<EvolutionGoDownloadMediaResult> => {
        const started = Date.now();
        const path = "/message/downloadmedia";
        const url = `${base}${path}`;
        const body = { message };
        let status: number | null = null;
        let responseBody: unknown;
        let errorText: string | undefined;
        try {
          const res = await fetch(url, {
            method: "POST",
            headers: headers(true),
            body: JSON.stringify(body),
          });
          status = res.status;
          const texto = await res.text();
          responseBody = tryParseJsonBody(texto);
          if (!res.ok) {
            errorText = texto;
            const codigo = classificarErroDownloadMedia(res.status, responseBody);
            throw new EvolutionGoDownloadMediaError({
              status: res.status,
              codigo,
              body: responseBody,
              message: `Evolution GO error (${res.status}): ${texto}`,
            });
          }
          const normalizado = normalizarDownloadMediaBody(responseBody);
          if (!normalizado) {
            throw new EvolutionGoDownloadMediaError({
              status: res.status,
              codigo: "failed",
              body: responseBody,
              message: "Evolution downloadmedia sem base64",
            });
          }
          return normalizado;
        } catch (err) {
          if (!errorText) {
            errorText = err instanceof Error ? err.message : String(err);
          }
          throw err;
        } finally {
          emitLog({
            tipo: "message_downloadmedia",
            method: "POST",
            url,
            path,
            status,
            durationMs: Date.now() - started,
            requestBody: body,
            responseBody,
            error: errorText,
          });
        }
      })();
    },

    listLabels() {
      return request<unknown>("label_list", "GET", "/label/list");
    },

    editLabel(payload: { name: string; color: number; labelId?: string; deleted?: boolean }) {
      return request<unknown>("label_edit", "POST", "/label/edit", payload);
    },

    labelChat(payload: { jid: string; labelId: string }) {
      return request<unknown>("label_chat", "POST", "/label/chat", {
        jid: payload.jid,
        labelId: payload.labelId,
      });
    },

    unlabelChat(payload: { jid: string; labelId: string }) {
      return request<unknown>("unlabel_chat", "POST", "/unlabel/chat", {
        jid: payload.jid,
        labelId: payload.labelId,
      });
    },

    historySync(payload: { count?: number; messageInfo?: unknown } = {}) {
      return request<unknown>("chat_history_sync", "POST", "/chat/history-sync", payload);
    },
  };
}

export function parseGoCreateResponse(res: EvolutionGoCreateResponse) {
  return {
    instanceId: res.instanceId ?? res.data?.id ?? res.data?.instanceId ?? null,
    token: res.token ?? res.data?.token ?? null,
    name: res.name ?? res.data?.name ?? null,
  };
}

export {
  parseConnectionUpdateWebhook,
  parseGoConnectedEvent,
  parseGoConnectionLifecycleEvent,
  parseGoConnectionState,
  parseGoDisconnectedEvent,
  parseGoLoggedOutEvent,
  parseGoQrResponse,
} from "./connection-state";

function messageIdFromGoInfo(
  info: { ID?: string; Id?: string; id?: string } | undefined,
): string | null {
  const raw = info?.ID ?? info?.Id ?? info?.id;
  if (typeof raw !== "string") return null;
  const id = raw.trim();
  return id.length > 0 ? id : null;
}

/**
 * Extrai o ID WhatsApp da resposta de `/send/*`.
 * GO: `data.Info.ID`; legado Baileys: `key.id` / `id` / `messageId`.
 */
export function extractGoMessageId(res: EvolutionSendResponse): string | null {
  return (
    messageIdFromGoInfo(res.data?.Info) ??
    messageIdFromGoInfo(res.Info) ??
    (typeof res.key?.id === "string" && res.key.id.trim() ? res.key.id.trim() : null) ??
    (typeof res.id === "string" && res.id.trim() ? res.id.trim() : null) ??
    (typeof res.messageId === "string" && res.messageId.trim() ? res.messageId.trim() : null)
  );
}
