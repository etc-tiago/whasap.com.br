import type { EvolutionCredentials, EvolutionGoInstanceContext } from "./credentials";
import type { EvolutionQrResponse, EvolutionSendResponse } from "./types";

export type { EvolutionGoStatusResponse } from "./connection-state";

export type EvolutionConnectParams = {
  webhookUrl: string;
  phone?: string;
  subscribe?: readonly string[];
  /** Instância já conectada: aplica webhook/eventos sem reiniciar o QR. */
  immediate?: boolean;
};

export type EvolutionGoCreateResponse = {
  instanceId?: string;
  token?: string;
  name?: string;
  data?: {
    instanceId?: string;
    token?: string;
    name?: string;
  };
};

import type { EvolutionGoStatusResponse } from "./connection-state";

type Quoted = { messageId: string; participant?: string };

function quotedField(quoted?: Quoted) {
  return quoted ? { quoted: { messageId: quoted.messageId, participant: quoted.participant } } : {};
}

/**
 * Client Evolution GO (whatsmeow).
 * Spec oficial: `packages/evolution/swagger.json`
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
) {
  const base = credentials.baseUrl.replace(/\/$/, "");

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

  async function request<T>(
    method: string,
    path: string,
    body?: unknown,
    useInstanceToken = true,
  ): Promise<T> {
    const res = await fetch(`${base}${path}`, {
      method,
      headers: headers(useInstanceToken),
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Evolution GO error (${res.status}): ${err}`);
    }
    return res.json() as Promise<T>;
  }

  return {
    createInstance(params: { name: string; instanceId: string; token: string }) {
      return request<EvolutionGoCreateResponse>(
        "POST",
        "/instance/create",
        {
          name: params.name,
          instanceId: params.instanceId,
          token: params.token,
        },
        false,
      );
    },

    connect(params: EvolutionConnectParams) {
      return request(
        "POST",
        "/instance/connect",
        {
          webhookUrl: params.webhookUrl,
          phone: params.phone,
          subscribe: params.subscribe,
          immediate: params.immediate,
        },
        Boolean(instanceCtx?.instanceToken),
      );
    },

    pair(phone: string) {
      return request("POST", "/instance/pair", { phone }, false);
    },

    getQrCode() {
      return request<EvolutionQrResponse>("GET", "/instance/qr");
    },

    getStatus() {
      return request<EvolutionGoStatusResponse>("GET", "/instance/status");
    },

    disconnect() {
      return request("POST", "/instance/disconnect", undefined, Boolean(instanceCtx?.instanceToken));
    },

    deleteInstance(instanceId: string) {
      return request(
        "DELETE",
        `/instance/delete/${encodeURIComponent(instanceId)}`,
        undefined,
        false,
      );
    },

    sendText(number: string, text: string, quoted?: Quoted) {
      return request<EvolutionSendResponse>("POST", "/send/text", {
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
      return request<EvolutionSendResponse>("POST", "/send/media", {
        number,
        type,
        url,
        caption,
        filename,
        ...quotedField(quoted),
      });
    },

    sendSticker(number: string, url: string, quoted?: Quoted) {
      return request<EvolutionSendResponse>("POST", "/send/sticker", {
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
      return request<EvolutionSendResponse>("POST", "/send/location", {
        number,
        latitude,
        longitude,
        name,
        address,
        ...quotedField(quoted),
      });
    },

    sendContact(number: string, vcard: unknown, quoted?: Quoted) {
      return request<EvolutionSendResponse>("POST", "/send/contact", {
        number,
        vcard,
        ...quotedField(quoted),
      });
    },

    sendButton(payload: unknown) {
      return request<EvolutionSendResponse>("POST", "/send/button", payload);
    },

    sendList(payload: unknown) {
      return request<EvolutionSendResponse>("POST", "/send/list", payload);
    },

    sendCarousel(payload: unknown) {
      return request<EvolutionSendResponse>("POST", "/send/carousel", payload);
    },

    sendPoll(payload: unknown) {
      return request<EvolutionSendResponse>("POST", "/send/poll", payload);
    },

    sendLink(payload: unknown) {
      return request<EvolutionSendResponse>("POST", "/send/link", payload);
    },

    markRead(number: string, ids: string[]) {
      return request("POST", "/message/markread", { number, id: ids });
    },

    react(number: string, messageId: string, emoji: string, fromMe = false) {
      return request<EvolutionSendResponse>("POST", "/message/react", {
        number,
        messageId,
        emoji,
        fromMe,
      });
    },

    downloadMedia(message: unknown) {
      return request<{ base64?: string; mimetype?: string; fileName?: string; data?: string }>(
        "POST",
        "/message/downloadmedia",
        { message },
      );
    },
  };
}

export function parseGoCreateResponse(res: EvolutionGoCreateResponse) {
  return {
    instanceId: res.instanceId ?? res.data?.instanceId ?? null,
    token: res.token ?? res.data?.token ?? null,
    name: res.name ?? res.data?.name ?? null,
  };
}

export {
  parseConnectionUpdateWebhook,
  parseGoConnectionState,
  parseGoQrResponse,
} from "./connection-state";

export function extractGoMessageId(
  res: EvolutionSendResponse & { id?: string; messageId?: string },
) {
  return res.key?.id ?? res.id ?? res.messageId ?? null;
}
