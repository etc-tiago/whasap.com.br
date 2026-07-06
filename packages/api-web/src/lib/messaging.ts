import { createEvolutionClient } from "@whasap/evolution";
import { createMetaClient } from "@whasap/meta";

import { getEvolutionCreds, getMetaCreds } from "../handlers/instancia";
import type { WebContext } from "../types";

type SendParams = {
  ctx: WebContext;
  instance: {
    provider: "cloud_api" | "evolution";
    evolutionInstanceName: string | null;
    evolutionSecretName: string | null;
    cloudAccessTokenSecretName: string | null;
  };
  phone: string;
  type: string;
  body?: string | null;
  mediaUrl?: string;
  latitude?: number;
  longitude?: number;
  localNome?: string;
  localEndereco?: string;
  templateName?: string;
  templateLanguage?: string;
  templateComponents?: unknown[];
};

export async function sendProviderMessage(params: SendParams): Promise<string | null> {
  const { ctx, instance, phone, type } = params;
  const normalizedPhone = phone.replace(/\D/g, "");

  if (instance.provider === "evolution" && instance.evolutionInstanceName) {
    const creds = await getEvolutionCreds(ctx, instance);
    const client = createEvolutionClient(creds);
    const name = instance.evolutionInstanceName;

    if (type === "text" && params.body) {
      const res = await client.sendText(name, normalizedPhone, params.body);
      return res.key?.id ?? null;
    }
    if (["image", "video", "audio", "document"].includes(type) && params.mediaUrl) {
      const res = await client.sendMedia(
        name,
        normalizedPhone,
        type as "image" | "video" | "audio" | "document",
        params.mediaUrl,
        params.body ?? undefined,
      );
      return res.key?.id ?? null;
    }
    if (type === "location" && params.latitude != null && params.longitude != null) {
      const res = await client.sendLocation(
        name,
        normalizedPhone,
        params.latitude,
        params.longitude,
        params.localNome,
        params.localEndereco,
      );
      return res.key?.id ?? null;
    }
    return null;
  }

  if (instance.provider === "cloud_api") {
    const creds = await getMetaCreds(ctx, instance);
    const client = createMetaClient(creds);

    if (type === "template" && params.templateName) {
      const res = await client.sendTemplate(
        normalizedPhone,
        params.templateName,
        params.templateLanguage ?? "pt_BR",
        params.templateComponents,
      );
      return res.messages[0]?.id ?? null;
    }
    if (type === "text" && params.body) {
      const res = await client.sendText(normalizedPhone, params.body);
      return res.messages[0]?.id ?? null;
    }
    if (type === "image" && params.mediaUrl) {
      const res = await client.sendImage(normalizedPhone, params.mediaUrl, params.body ?? undefined);
      return res.messages[0]?.id ?? null;
    }
    if (type === "document" && params.mediaUrl) {
      const res = await client.sendDocument(normalizedPhone, params.mediaUrl);
      return res.messages[0]?.id ?? null;
    }
    if (type === "location" && params.latitude != null && params.longitude != null) {
      const res = await client.sendLocation(
        normalizedPhone,
        params.latitude,
        params.longitude,
        params.localNome,
        params.localEndereco,
      );
      return res.messages[0]?.id ?? null;
    }
  }

  return null;
}

export function isCloudWindowOpen(cloudWindowExpiresAt: Date | null): boolean {
  if (!cloudWindowExpiresAt) return false;
  return cloudWindowExpiresAt.getTime() > Date.now();
}

export function cloudRequiresTemplate(
  provider: "cloud_api" | "evolution",
  cloudWindowExpiresAt: Date | null,
  isNewConversation: boolean,
): boolean {
  if (provider !== "cloud_api") return false;
  if (isNewConversation) return true;
  return !isCloudWindowOpen(cloudWindowExpiresAt);
}
