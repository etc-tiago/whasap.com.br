export type MetaMessageRaw = Record<string, unknown>;

export type MetaStatusRaw = Record<string, unknown>;

export type MetaWebhookChange = {
  phoneNumberId: string;
  displayPhoneNumber: string | null;
  contacts: Array<{ waId: string; name: string | null; userId: string | null }>;
  messages: MetaMessageRaw[];
  statuses: MetaStatusRaw[];
};

export type MetaMensagemNormalizada = {
  phone: string;
  externalId: string;
  body: string;
  type: string;
  timestamp: Date | null;
  metadados: Record<string, unknown>;
};

export type MetaPricingNormalizado = {
  billable: boolean | null;
  pricingModel: string | null;
  category: string | null;
  type: string | null;
};

export type MetaStatusNormalizado = {
  externalId: string;
  status: string;
  recipientId: string | null;
  recipientUserId: string | null;
  pricing: MetaPricingNormalizado | null;
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
          typeof metadata?.display_phone_number === "string" ? metadata.display_phone_number : null,
        contacts: ((value.contacts as Array<Record<string, unknown>>) ?? []).map((c) => ({
          waId: String(c.wa_id ?? ""),
          name: (c.profile as { name?: string } | undefined)?.name ?? null,
          userId: typeof c.user_id === "string" && c.user_id ? c.user_id : null,
        })),
        messages: (value.messages as MetaMessageRaw[]) ?? [],
        statuses: (value.statuses as MetaStatusRaw[]) ?? [],
      });
    }
  }
  return changes;
}

/** Unix seconds/ms do campo `timestamp` Meta Cloud → Date. */
function timestampFromMeta(msg: MetaMessageRaw): Date | null {
  const raw = msg.timestamp;
  if (typeof raw !== "string" && typeof raw !== "number") return null;
  const n = typeof raw === "string" ? Number(raw) : raw;
  if (!Number.isFinite(n) || n <= 0) return null;
  const ms = n > 1_000_000_000_000 ? n : n * 1000;
  const d = new Date(ms);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Normaliza mensagem inbound Meta Cloud. */
export function parseMetaMessage(msg: MetaMessageRaw): MetaMensagemNormalizada | null {
  const phone = String(msg.from ?? "");
  const externalId = String(msg.id ?? "");
  if (!phone || !externalId) return null;

  const timestamp = timestampFromMeta(msg);
  const rawType = String(msg.type ?? "unsupported");
  const metadados: Record<string, unknown> = { metaType: rawType };
  if (typeof msg.from_user_id === "string" && msg.from_user_id) {
    metadados.fromUserId = msg.from_user_id;
  }

  switch (rawType) {
    case "text": {
      const text = msg.text as { body?: string } | undefined;
      return {
        phone,
        externalId,
        body: text?.body ?? "",
        type: "text",
        timestamp,
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
        timestamp,
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
        timestamp,
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
        timestamp,
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
        timestamp,
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
        timestamp,
        metadados: { ...metadados, ...metaMediaMetadados("sticker", sticker) },
      };
    }
    case "location": {
      const location = msg.location as
        | { latitude?: number; longitude?: number; name?: string }
        | undefined;
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
        timestamp,
        metadados: { ...metadados, location },
      };
    }
    case "contacts": {
      const contacts = msg.contacts as Array<{ name?: { formatted_name?: string } }> | undefined;
      const names =
        contacts
          ?.map((c) => c.name?.formatted_name)
          .filter(Boolean)
          .join(", ") ?? "";
      return {
        phone,
        externalId,
        body: names || "[contato]",
        type: "contacts",
        timestamp,
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
        timestamp,
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
        timestamp,
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
        timestamp,
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
        timestamp,
        metadados: {
          ...metadados,
          errors: msg.errors,
        },
      };
    }
  }
}

/** Normaliza pricing de status Meta Cloud (PMP). */
export function parseMetaPricing(raw: unknown): MetaPricingNormalizado | null {
  if (!raw || typeof raw !== "object") return null;
  const p = raw as Record<string, unknown>;
  const pricingModel = typeof p.pricing_model === "string" ? p.pricing_model : null;
  const category = typeof p.category === "string" ? p.category : null;
  const type = typeof p.type === "string" ? p.type : null;
  const billable = typeof p.billable === "boolean" ? p.billable : null;
  if (pricingModel === null && category === null && type === null && billable === null) {
    return null;
  }
  return { billable, pricingModel, category, type };
}

/** Normaliza status de entrega Meta Cloud. */
export function parseMetaStatus(status: MetaStatusRaw): MetaStatusNormalizado | null {
  const externalId = String(status.id ?? "");
  const deliveryStatus = String(status.status ?? "");
  if (!externalId || !deliveryStatus) return null;
  return {
    externalId,
    status: deliveryStatus,
    recipientId: typeof status.recipient_id === "string" ? status.recipient_id : null,
    recipientUserId: typeof status.recipient_user_id === "string" ? status.recipient_user_id : null,
    pricing: parseMetaPricing(status.pricing),
  };
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
