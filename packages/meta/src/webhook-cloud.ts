export type MetaMessageRaw = Record<string, unknown>;

export type MetaStatusRaw = Record<string, unknown>;

export type MetaWebhookChange = {
  phoneNumberId: string;
  displayPhoneNumber: string | null;
  contacts: Array<{ waId: string; name: string | null }>;
  messages: MetaMessageRaw[];
  statuses: MetaStatusRaw[];
};

export type MetaMensagemNormalizada = {
  phone: string;
  externalId: string;
  body: string;
  type: string;
  metadados: Record<string, unknown>;
};

export type MetaStatusNormalizado = {
  externalId: string;
  status: string;
};

type MetaMediaPart = {
  id?: string;
  caption?: string;
  mime_type?: string;
  filename?: string;
};

const MEDIA_TYPES = new Set(["image", "audio", "document", "video", "sticker"]);

function metaMediaMetadados(
  type: string,
  part: MetaMediaPart | undefined,
): Record<string, unknown> {
  if (!part?.id) return {};
  return {
    mediaId: part.id,
    mimeType: part.mime_type,
    fileName: part.filename,
    mediaType: type,
  };
}

/** JID canônico org a partir do wa_id Meta Cloud. */
export function resolverIdExternoCanonicoMeta(waId: string): string {
  const digits = waId.replace(/\D/g, "");
  return `${digits}@s.whatsapp.net`;
}

/** Normaliza payload webhook Meta Cloud API em changes flat. */
export function parseMetaWebhook(payload: unknown): MetaWebhookChange[] {
  if (!payload || typeof payload !== "object") return [];
  const obj = payload as Record<string, unknown>;
  if (obj.object !== "whatsapp_business_account") return [];

  const changes: MetaWebhookChange[] = [];
  for (const entry of (obj.entry as Array<Record<string, unknown>>) ?? []) {
    for (const change of (entry.changes as Array<Record<string, unknown>>) ?? []) {
      const value = change.value as Record<string, unknown> | undefined;
      if (!value) continue;

      const metadata = value.metadata as Record<string, unknown> | undefined;
      const phoneNumberId = String(metadata?.phone_number_id ?? "");
      if (!phoneNumberId) continue;

      changes.push({
        phoneNumberId,
        displayPhoneNumber:
          typeof metadata?.display_phone_number === "string"
            ? metadata.display_phone_number
            : null,
        contacts: ((value.contacts as Array<Record<string, unknown>>) ?? []).map((c) => ({
          waId: String(c.wa_id ?? ""),
          name: (c.profile as { name?: string } | undefined)?.name ?? null,
        })),
        messages: (value.messages as MetaMessageRaw[]) ?? [],
        statuses: (value.statuses as MetaStatusRaw[]) ?? [],
      });
    }
  }
  return changes;
}

/** Normaliza mensagem inbound Meta Cloud. */
export function parseMetaMessage(msg: MetaMessageRaw): MetaMensagemNormalizada | null {
  const phone = String(msg.from ?? "");
  const externalId = String(msg.id ?? "");
  if (!phone || !externalId) return null;

  const rawType = String(msg.type ?? "unsupported");
  const metadados: Record<string, unknown> = { metaType: rawType };

  switch (rawType) {
    case "text": {
      const text = msg.text as { body?: string } | undefined;
      return {
        phone,
        externalId,
        body: text?.body ?? "",
        type: "text",
        metadados,
      };
    }
    case "image": {
      const image = msg.image as MetaMediaPart | undefined;
      return {
        phone,
        externalId,
        body: image?.caption ?? "[imagem]",
        type: "image",
        metadados: { ...metadados, ...metaMediaMetadados("image", image) },
      };
    }
    case "audio": {
      const audio = msg.audio as MetaMediaPart | undefined;
      return {
        phone,
        externalId,
        body: "[áudio]",
        type: "audio",
        metadados: { ...metadados, ...metaMediaMetadados("audio", audio) },
      };
    }
    case "video": {
      const video = msg.video as MetaMediaPart | undefined;
      return {
        phone,
        externalId,
        body: video?.caption ?? "[vídeo]",
        type: "video",
        metadados: { ...metadados, ...metaMediaMetadados("video", video) },
      };
    }
    case "document": {
      const document = msg.document as MetaMediaPart | undefined;
      return {
        phone,
        externalId,
        body: document?.filename ?? document?.caption ?? "[documento]",
        type: "document",
        metadados: { ...metadados, ...metaMediaMetadados("document", document) },
      };
    }
    case "sticker": {
      const sticker = msg.sticker as MetaMediaPart | undefined;
      return {
        phone,
        externalId,
        body: "[sticker]",
        type: "sticker",
        metadados: { ...metadados, ...metaMediaMetadados("sticker", sticker) },
      };
    }
    case "location": {
      const location = msg.location as { latitude?: number; longitude?: number; name?: string } | undefined;
      const label =
        location?.name ??
        (location?.latitude !== undefined && location?.longitude !== undefined
          ? `${location.latitude}, ${location.longitude}`
          : "[localização]");
      return {
        phone,
        externalId,
        body: label,
        type: "location",
        metadados: { ...metadados, location },
      };
    }
    case "contacts": {
      const contacts = msg.contacts as Array<{ name?: { formatted_name?: string } }> | undefined;
      const names =
        contacts?.map((c) => c.name?.formatted_name).filter(Boolean).join(", ") ?? "";
      return {
        phone,
        externalId,
        body: names || "[contato]",
        type: "contacts",
        metadados: { ...metadados, contacts },
      };
    }
    case "interactive": {
      const interactive = msg.interactive as Record<string, unknown> | undefined;
      const interactiveType = String(interactive?.type ?? "");
      let body = "[interativo]";
      if (interactiveType === "button_reply") {
        const reply = interactive?.button_reply as { id?: string; title?: string } | undefined;
        body = reply?.title ?? reply?.id ?? body;
        metadados.buttonReply = reply;
      } else if (interactiveType === "list_reply") {
        const reply = interactive?.list_reply as { id?: string; title?: string } | undefined;
        body = reply?.title ?? reply?.id ?? body;
        metadados.listReply = reply;
      }
      metadados.interactive = interactive;
      return {
        phone,
        externalId,
        body,
        type: "interactive",
        metadados,
      };
    }
    case "button": {
      const button = msg.button as { payload?: string; text?: string } | undefined;
      return {
        phone,
        externalId,
        body: button?.text ?? button?.payload ?? "[botão]",
        type: "button",
        metadados: { ...metadados, button },
      };
    }
    case "reaction": {
      const reaction = msg.reaction as { emoji?: string; message_id?: string } | undefined;
      return {
        phone,
        externalId,
        body: reaction?.emoji ?? "[reação]",
        type: "reaction",
        metadados: { ...metadados, reaction },
      };
    }
    case "unsupported":
    default: {
      return {
        phone,
        externalId,
        body: "[não suportado]",
        type: "unsupported",
        metadados: {
          ...metadados,
          errors: msg.errors,
        },
      };
    }
  }
}

/** Normaliza status de entrega Meta Cloud. */
export function parseMetaStatus(status: MetaStatusRaw): MetaStatusNormalizado | null {
  const externalId = String(status.id ?? "");
  const deliveryStatus = String(status.status ?? "");
  if (!externalId || !deliveryStatus) return null;
  return { externalId, status: deliveryStatus };
}

/** Indica se o tipo normalizado tem mídia para download. */
export function metaMessageTemMidia(type: string): boolean {
  return MEDIA_TYPES.has(type);
}

/** Extrai dados de mídia do metadados de parseMetaMessage. */
export function metaMidiaDeMetadados(metadados: Record<string, unknown>) {
  const mediaId = typeof metadados.mediaId === "string" ? metadados.mediaId : null;
  if (!mediaId) return null;
  return {
    mediaId,
    mimeType: typeof metadados.mimeType === "string" ? metadados.mimeType : undefined,
    fileName: typeof metadados.fileName === "string" ? metadados.fileName : undefined,
  };
}
