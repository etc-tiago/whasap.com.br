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

  return {
    sendText(to: string, text: string) {
      return graph<{ messages: Array<{ id: string }> }>("POST", `/${credentials.phoneNumberId}/messages`, {
        messaging_product: "whatsapp",
        to,
        type: "text",
        text: { body: text },
      });
    },

    sendTemplate(
      to: string,
      templateName: string,
      languageCode: string,
      components?: unknown[],
    ) {
      return graph<{ messages: Array<{ id: string }> }>("POST", `/${credentials.phoneNumberId}/messages`, {
        messaging_product: "whatsapp",
        to,
        type: "template",
        template: {
          name: templateName,
          language: { code: languageCode },
          ...(components ? { components } : {}),
        },
      });
    },

    sendImage(to: string, imageUrl: string, caption?: string) {
      return graph<{ messages: Array<{ id: string }> }>("POST", `/${credentials.phoneNumberId}/messages`, {
        messaging_product: "whatsapp",
        to,
        type: "image",
        image: { link: imageUrl, ...(caption ? { caption } : {}) },
      });
    },

    sendDocument(to: string, documentUrl: string, filename?: string) {
      return graph<{ messages: Array<{ id: string }> }>("POST", `/${credentials.phoneNumberId}/messages`, {
        messaging_product: "whatsapp",
        to,
        type: "document",
        document: { link: documentUrl, ...(filename ? { filename } : {}) },
      });
    },

    sendLocation(to: string, latitude: number, longitude: number, name?: string, address?: string) {
      return graph<{ messages: Array<{ id: string }> }>("POST", `/${credentials.phoneNumberId}/messages`, {
        messaging_product: "whatsapp",
        to,
        type: "location",
        location: { latitude, longitude, name, address },
      });
    },

    sendContacts(to: string, contacts: unknown[]) {
      return graph<{ messages: Array<{ id: string }> }>("POST", `/${credentials.phoneNumberId}/messages`, {
        messaging_product: "whatsapp",
        to,
        type: "contacts",
        contacts,
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
