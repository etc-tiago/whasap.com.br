import { mvpDefaults } from "@whasap/config";

import type { MetaCredentials } from "./credentials";

const API_VERSION = mvpDefaults.meta.apiVersion;

export type MetaTemplate = {
  id: string;
  name: string;
  language: string;
  status: string;
  category: string;
  components: unknown[];
};

export type MetaRequestLogEntry = {
  /** Ação semântica (ex.: send_text, list_templates, media_download). */
  acao: string;
  method: string;
  url: string;
  path: string;
  status: number | null;
  durationMs: number;
  requestBody?: unknown;
  responseBody?: unknown;
  error?: string;
};

export type MetaLogSink = {
  onRequest: (entry: MetaRequestLogEntry) => void | Promise<void>;
};

export type MetaClientOptions = {
  log?: MetaLogSink;
};

type MessageOptions = {
  contextMessageId?: string;
};

function buildContext(options?: MessageOptions) {
  return options?.contextMessageId ? { context: { message_id: options.contextMessageId } } : {};
}

function tryParseJsonBody(texto: string): unknown {
  try {
    return JSON.parse(texto) as unknown;
  } catch {
    return { raw: texto };
  }
}

export function createMetaClient(credentials: MetaCredentials, options?: MetaClientOptions) {
  const base = `https://graph.facebook.com/${API_VERSION}`;
  const logSink = options?.log;

  function emitLog(entry: MetaRequestLogEntry) {
    if (!logSink) return;
    void Promise.resolve(logSink.onRequest(entry)).catch(() => {
      // sink não deve falhar a requisição
    });
  }

  async function graph<T>(
    acao: string,
    method: string,
    path: string,
    body?: unknown,
  ): Promise<T> {
    const started = Date.now();
    const url = `${base}${path}${path.includes("?") ? "&" : "?"}access_token=${encodeURIComponent(credentials.accessToken)}`;
    let status: number | null = null;
    let responseBody: unknown;
    let errorText: string | undefined;

    try {
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: body !== undefined ? JSON.stringify(body) : undefined,
      });
      status = res.status;
      if (!res.ok) {
        errorText = await res.text();
        responseBody = tryParseJsonBody(errorText);
        throw new Error(`Meta Graph API error (${res.status}): ${errorText}`);
      }
      responseBody = await res.json();
      return responseBody as T;
    } catch (err) {
      if (!errorText) {
        errorText = err instanceof Error ? err.message : String(err);
      }
      throw err;
    } finally {
      emitLog({
        acao,
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

  const messageBase = (to: string, options?: MessageOptions) => ({
    messaging_product: "whatsapp" as const,
    recipient_type: "individual" as const,
    to,
    ...buildContext(options),
  });

  return {
    sendText(to: string, text: string, options?: MessageOptions) {
      return graph<{ messages: Array<{ id: string }> }>(
        "send_text",
        "POST",
        `/${credentials.phoneNumberId}/messages`,
        {
          ...messageBase(to, options),
          type: "text",
          text: { body: text },
        },
      );
    },

    sendTemplate(to: string, templateName: string, languageCode: string, components?: unknown[]) {
      return graph<{ messages: Array<{ id: string }> }>(
        "send_template",
        "POST",
        `/${credentials.phoneNumberId}/messages`,
        {
          ...messageBase(to),
          type: "template",
          template: {
            name: templateName,
            language: { code: languageCode },
            ...(components ? { components } : {}),
          },
        },
      );
    },

    sendImage(to: string, imageUrl: string, caption?: string, options?: MessageOptions) {
      return graph<{ messages: Array<{ id: string }> }>(
        "send_image",
        "POST",
        `/${credentials.phoneNumberId}/messages`,
        {
          ...messageBase(to, options),
          type: "image",
          image: { link: imageUrl, ...(caption ? { caption } : {}) },
        },
      );
    },

    sendAudio(to: string, audioUrl: string, voice?: boolean, options?: MessageOptions) {
      return graph<{ messages: Array<{ id: string }> }>(
        "send_audio",
        "POST",
        `/${credentials.phoneNumberId}/messages`,
        {
          ...messageBase(to, options),
          type: "audio",
          audio: { link: audioUrl, ...(voice ? { voice: true } : {}) },
        },
      );
    },

    sendVideo(to: string, videoUrl: string, caption?: string, options?: MessageOptions) {
      return graph<{ messages: Array<{ id: string }> }>(
        "send_video",
        "POST",
        `/${credentials.phoneNumberId}/messages`,
        {
          ...messageBase(to, options),
          type: "video",
          video: { link: videoUrl, ...(caption ? { caption } : {}) },
        },
      );
    },

    sendDocument(to: string, documentUrl: string, filename?: string, options?: MessageOptions) {
      return graph<{ messages: Array<{ id: string }> }>(
        "send_document",
        "POST",
        `/${credentials.phoneNumberId}/messages`,
        {
          ...messageBase(to, options),
          type: "document",
          document: { link: documentUrl, ...(filename ? { filename } : {}) },
        },
      );
    },

    sendSticker(to: string, stickerUrl: string, options?: MessageOptions) {
      return graph<{ messages: Array<{ id: string }> }>(
        "send_sticker",
        "POST",
        `/${credentials.phoneNumberId}/messages`,
        {
          ...messageBase(to, options),
          type: "sticker",
          sticker: { link: stickerUrl },
        },
      );
    },

    sendLocation(to: string, latitude: number, longitude: number, name?: string, address?: string) {
      return graph<{ messages: Array<{ id: string }> }>(
        "send_location",
        "POST",
        `/${credentials.phoneNumberId}/messages`,
        {
          ...messageBase(to),
          type: "location",
          location: { latitude, longitude, name, address },
        },
      );
    },

    sendContacts(to: string, contacts: unknown[]) {
      return graph<{ messages: Array<{ id: string }> }>(
        "send_contacts",
        "POST",
        `/${credentials.phoneNumberId}/messages`,
        {
          ...messageBase(to),
          type: "contacts",
          contacts,
        },
      );
    },

    sendInteractive(to: string, interactive: unknown, options?: MessageOptions) {
      return graph<{ messages: Array<{ id: string }> }>(
        "send_interactive",
        "POST",
        `/${credentials.phoneNumberId}/messages`,
        {
          ...messageBase(to, options),
          type: "interactive",
          interactive,
        },
      );
    },

    sendReaction(to: string, messageId: string, emoji: string) {
      return graph<{ messages: Array<{ id: string }> }>(
        "send_reaction",
        "POST",
        `/${credentials.phoneNumberId}/messages`,
        {
          ...messageBase(to),
          type: "reaction",
          reaction: { message_id: messageId, emoji },
        },
      );
    },

    markAsRead(messageId: string, typingIndicator?: { type: "text" }) {
      return graph<{ success: boolean }>(
        "mark_as_read",
        "POST",
        `/${credentials.phoneNumberId}/messages`,
        {
          messaging_product: "whatsapp",
          status: "read",
          message_id: messageId,
          ...(typingIndicator ? { typing_indicator: typingIndicator } : {}),
        },
      );
    },

    async uploadMedia(buffer: ArrayBuffer, mimeType: string, filename?: string) {
      const started = Date.now();
      const path = `/${credentials.phoneNumberId}/media`;
      const url = `${base}${path}?access_token=${encodeURIComponent(credentials.accessToken)}`;
      const form = new FormData();
      form.append("messaging_product", "whatsapp");
      form.append("type", mimeType);
      form.append("file", new Blob([buffer], { type: mimeType }), filename ?? "media");

      let status: number | null = null;
      let responseBody: unknown;
      let errorText: string | undefined;

      try {
        const res = await fetch(url, { method: "POST", body: form });
        status = res.status;
        if (!res.ok) {
          errorText = await res.text();
          responseBody = tryParseJsonBody(errorText);
          throw new Error(`Meta media upload error (${res.status}): ${errorText}`);
        }
        responseBody = await res.json();
        return responseBody as { id: string };
      } catch (err) {
        if (!errorText) {
          errorText = err instanceof Error ? err.message : String(err);
        }
        throw err;
      } finally {
        emitLog({
          acao: "media_upload",
          method: "POST",
          url,
          path,
          status,
          durationMs: Date.now() - started,
          requestBody: { mimeType, filename: filename ?? "media", bytes: buffer.byteLength },
          responseBody,
          error: errorText,
        });
      }
    },

    listTemplates() {
      return graph<{ data: MetaTemplate[] }>(
        "list_templates",
        "GET",
        `/${credentials.wabaId}/message_templates?limit=100`,
      );
    },

    getMediaInfo(mediaId: string) {
      return graph<{ url: string; mime_type: string; file_size?: number }>(
        "get_media_info",
        "GET",
        `/${mediaId}`,
      );
    },

    async downloadMedia(mediaId: string) {
      const info = await graph<{ url: string; mime_type: string }>(
        "get_media_info",
        "GET",
        `/${mediaId}`,
      );

      const started = Date.now();
      let status: number | null = null;
      let errorText: string | undefined;

      try {
        const res = await fetch(info.url, {
          headers: { Authorization: `Bearer ${credentials.accessToken}` },
        });
        status = res.status;
        if (!res.ok) {
          errorText = await res.text();
          throw new Error(`Meta media download error (${res.status}): ${errorText}`);
        }
        const buffer = await res.arrayBuffer();
        return {
          buffer,
          mimeType: info.mime_type,
        };
      } catch (err) {
        if (!errorText) {
          errorText = err instanceof Error ? err.message : String(err);
        }
        throw err;
      } finally {
        emitLog({
          acao: "media_download",
          method: "GET",
          url: info.url,
          path: new URL(info.url).pathname,
          status,
          durationMs: Date.now() - started,
          requestBody: { mediaId },
          responseBody: status && status >= 200 && status < 300 ? { mimeType: info.mime_type } : tryParseJsonBody(errorText ?? ""),
          error: errorText,
        });
      }
    },
  };
}

export function extractMetaMessageId(res: { messages?: Array<{ id: string }> }) {
  return res.messages?.[0]?.id ?? null;
}
