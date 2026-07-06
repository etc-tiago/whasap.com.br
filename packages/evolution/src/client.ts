import type { EvolutionCredentials } from "./credentials";

export type EvolutionConnectionState = "open" | "close" | "connecting";

export type EvolutionQrResponse = {
  pairingCode?: string;
  code?: string;
  base64?: string;
  count?: number;
};

export function createEvolutionClient(credentials: EvolutionCredentials) {
  const headers = {
    "Content-Type": "application/json",
    apikey: credentials.apiKey,
  };

  async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
    const res = await fetch(`${credentials.baseUrl.replace(/\/$/, "")}${path}`, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Evolution API error (${res.status}): ${err}`);
    }
    return res.json() as Promise<T>;
  }

  return {
    createInstance(instanceName: string, webhookUrl: string) {
      return request<{ instance: { instanceName: string } }>("POST", "/instance/create", {
        instanceName,
        integration: "WHATSAPP-BAILEYS",
        qrcode: true,
        webhook: webhookUrl,
        webhookByEvents: false,
        webhookBase64: true,
      });
    },

    getConnectionState(instanceName: string) {
      return request<{ instance: { state: EvolutionConnectionState } }>(
        "GET",
        `/instance/connectionState/${encodeURIComponent(instanceName)}`,
      );
    },

    getQrCode(instanceName: string) {
      return request<EvolutionQrResponse>(
        "GET",
        `/instance/connect/${encodeURIComponent(instanceName)}`,
      );
    },

    sendText(instanceName: string, number: string, text: string) {
      return request<{ key: { id: string } }>("POST", `/message/sendText/${encodeURIComponent(instanceName)}`, {
        number,
        text,
      });
    },

    sendMedia(
      instanceName: string,
      number: string,
      mediaType: "image" | "video" | "audio" | "document",
      media: string,
      caption?: string,
    ) {
      return request<{ key: { id: string } }>(
        "POST",
        `/message/sendMedia/${encodeURIComponent(instanceName)}`,
        { number, mediatype: mediaType, media, caption },
      );
    },

    sendLocation(
      instanceName: string,
      number: string,
      latitude: number,
      longitude: number,
      name?: string,
      address?: string,
    ) {
      return request<{ key: { id: string } }>(
        "POST",
        `/message/sendLocation/${encodeURIComponent(instanceName)}`,
        { number, latitude, longitude, name, address },
      );
    },

    sendContact(instanceName: string, number: string, contacts: unknown[]) {
      return request<{ key: { id: string } }>(
        "POST",
        `/message/sendContact/${encodeURIComponent(instanceName)}`,
        { number, contact: contacts },
      );
    },
  };
}
