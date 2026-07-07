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

type MessageOptions = {
  contextMessageId?: string;
};

function buildContext(options?: MessageOptions) {
  return options?.contextMessageId ? { context: { message_id: options.contextMessageId } } : {};
}

export function createMetaClient(credentials: MetaCredentials) {
  const base = `https://graph.facebook.com/${API_VERSION}`;

  async function graph<T>(method: string, path: string, body?: unknown): Promise<T> {
    const url = `${base}${path}${path.includes("?") ? "&" : "?"}access_token=${encodeURIComponent(credentials.accessToken)}`;
    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Meta Graph API error (${res.status}): ${err}`);
    }
    return res.json() as Promise<T>;
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
      return graph<{ success: boolean }>("POST", `/${credentials.phoneNumberId}/messages`, {
        messaging_product: "whatsapp",
        status: "read",
        message_id: messageId,
        ...(typingIndicator ? { typing_indicator: typingIndicator } : {}),
      });
    },

    uploadMedia(buffer: ArrayBuffer, mimeType: string, filename?: string) {
      const form = new FormData();
      form.append("messaging_product", "whatsapp");
      form.append("type", mimeType);
      form.append("file", new Blob([buffer], { type: mimeType }), filename ?? "media");
      const url = `${base}/${credentials.phoneNumberId}/media?access_token=${encodeURIComponent(credentials.accessToken)}`;
      return fetch(url, { method: "POST", body: form }).then(async (res) => {
        if (!res.ok) {
          const err = await res.text();
          throw new Error(`Meta media upload error (${res.status}): ${err}`);
        }
        return res.json() as Promise<{ id: string }>;
      });
    },

    listTemplates() {
      return graph<{ data: MetaTemplate[] }>(
        "GET",
        `/${credentials.wabaId}/message_templates?limit=100`,
      );
    },

    getMediaInfo(mediaId: string) {
      return graph<{ url: string; mime_type: string; file_size?: number }>("GET", `/${mediaId}`);
    },

    async downloadMedia(mediaId: string) {
      const info = await graph<{ url: string; mime_type: string }>("GET", `/${mediaId}`);
      const res = await fetch(info.url, {
        headers: { Authorization: `Bearer ${credentials.accessToken}` },
      });
      if (!res.ok) {
        const err = await res.text();
        throw new Error(`Meta media download error (${res.status}): ${err}`);
      }
      return {
        buffer: await res.arrayBuffer(),
        mimeType: info.mime_type,
      };
    },
  };
}

export function extractMetaMessageId(res: { messages?: Array<{ id: string }> }) {
  return res.messages?.[0]?.id ?? null;
}
