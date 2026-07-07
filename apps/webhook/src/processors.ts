import { appCreateData, type Client } from "@whasap/db";

import type { Env } from "./env";
import { type InboundMediaJob, scheduleInboundMedia } from "./media";

type EvolutionPayload = {
  event?: string;
  instance?: string;
  data?: {
    state?: string;
    key?: { remoteJid?: string; fromMe?: boolean; id?: string };
    message?: Record<string, unknown>;
    pushName?: string;
  };
};

type EvolutionMediaPart = {
  caption?: string;
  mimetype?: string;
  fileName?: string;
  base64?: string;
};

const MEDIA_TYPES = new Set(["image", "audio", "document", "video"]);

function evolutionMediaFromMessage(messageObj: Record<string, unknown>) {
  const msgBase64 = typeof messageObj.base64 === "string" ? messageObj.base64 : undefined;

  if (messageObj.imageMessage) {
    const part = messageObj.imageMessage as EvolutionMediaPart;
    return {
      type: "image" as const,
      body: part.caption ?? "[imagem]",
      mimeType: part.mimetype,
      base64: part.base64 ?? msgBase64,
      fileName: part.fileName,
    };
  }
  if (messageObj.audioMessage) {
    const part = messageObj.audioMessage as EvolutionMediaPart;
    return {
      type: "audio" as const,
      body: "[áudio]",
      mimeType: part.mimetype,
      base64: part.base64 ?? msgBase64,
      fileName: part.fileName,
    };
  }
  if (messageObj.documentMessage) {
    const part = messageObj.documentMessage as EvolutionMediaPart;
    return {
      type: "document" as const,
      body: part.fileName ?? part.caption ?? "[documento]",
      mimeType: part.mimetype,
      base64: part.base64 ?? msgBase64,
      fileName: part.fileName,
    };
  }
  if (messageObj.videoMessage) {
    const part = messageObj.videoMessage as EvolutionMediaPart;
    return {
      type: "video" as const,
      body: part.caption ?? "[vídeo]",
      mimeType: part.mimetype,
      base64: part.base64 ?? msgBase64,
      fileName: part.fileName,
    };
  }
  return null;
}

export async function processEvolutionWebhook(
  client: Client,
  env: Env,
  ctx: ExecutionContext,
  body: string,
): Promise<void> {
  const payload = JSON.parse(body) as EvolutionPayload;
  const event = payload.event ?? "";
  const instanceName = payload.instance;

  if (!instanceName) return;

  const instance = await client.instancia.findFirst({
    where: { evolucaoNomeInstancia: instanceName },
  });
  if (!instance) return;

  if (event === "connection.update") {
    const state = payload.data?.state;
    if (state === "open") {
      await client.instancia.update({
        where: { id: instance.id },
        data: {
          status: instance.asaasIdAssinatura ? "connected" : "pending_payment",
          conectadoEm: new Date(),
        },
      });
    }
    return;
  }

  if (event !== "messages.upsert" && event !== "MESSAGES_UPSERT") return;

  const remoteJid = payload.data?.key?.remoteJid;
  const messageId = payload.data?.key?.id;
  if (!remoteJid || !messageId) return;

  const phone = remoteJid.replace(/@.*/, "").replace(/\D/g, "");
  const pushName = payload.data?.pushName;
  const messageObj = payload.data?.message as Record<string, unknown> | undefined;
  if (!messageObj) return;

  let bodyText: string | null = null;
  let type = "text";
  let mediaInfo: ReturnType<typeof evolutionMediaFromMessage> = null;

  if (messageObj.conversation) {
    bodyText = String(messageObj.conversation);
  } else if (messageObj.extendedTextMessage) {
    bodyText = String((messageObj.extendedTextMessage as { text?: string }).text ?? "");
  } else if (messageObj.locationMessage) {
    type = "location";
    bodyText = "[localização]";
  } else {
    mediaInfo = evolutionMediaFromMessage(messageObj);
    if (mediaInfo) {
      type = mediaInfo.type;
      bodyText = mediaInfo.body;
    }
  }

  if (!bodyText) return;

  const messageKey = {
    remoteJid,
    fromMe: payload.data?.key?.fromMe ?? false,
    id: messageId,
  };

  const result = await ingestInboundMessage(client, {
    instanciaId: instance.id,
    phone,
    contactName: pushName ?? null,
    body: bodyText,
    type,
    externalId: messageId,
    isCloud: false,
  });
  if (!result) return;

  if (mediaInfo && MEDIA_TYPES.has(type)) {
    scheduleInboundMedia(ctx, env, client, {
      provider: "evolution",
      instanceUuid: instance.uuid,
      messageId: result.messageId,
      externalId: messageId,
      type,
      instanceName,
      messageKey,
      mimeType: mediaInfo.mimeType,
      base64: mediaInfo.base64,
      fileName: mediaInfo.fileName,
    });
  }
}

type MetaMessage = {
  from: string;
  id: string;
  type: string;
  text?: { body: string };
  image?: { id: string; caption?: string; mime_type?: string };
  audio?: { id: string; mime_type?: string };
  document?: { id: string; filename?: string; mime_type?: string };
  video?: { id: string; caption?: string; mime_type?: string };
};

type MetaPayload = {
  object?: string;
  entry?: Array<{
    changes?: Array<{
      value?: {
        metadata?: { phone_number_id?: string };
        messages?: MetaMessage[];
        statuses?: Array<{ id: string; status: string }>;
      };
    }>;
  }>;
};

function metaMediaFromMessage(msg: MetaMessage) {
  if (msg.type === "image" && msg.image) {
    return {
      type: "image" as const,
      body: msg.image.caption ?? "[imagem]",
      mediaId: msg.image.id,
      mimeType: msg.image.mime_type,
    };
  }
  if (msg.type === "audio" && msg.audio) {
    return {
      type: "audio" as const,
      body: "[áudio]",
      mediaId: msg.audio.id,
      mimeType: msg.audio.mime_type,
    };
  }
  if (msg.type === "document" && msg.document) {
    return {
      type: "document" as const,
      body: msg.document.filename ?? "[documento]",
      mediaId: msg.document.id,
      mimeType: msg.document.mime_type,
      fileName: msg.document.filename,
    };
  }
  if (msg.type === "video" && msg.video) {
    return {
      type: "video" as const,
      body: msg.video.caption ?? "[vídeo]",
      mediaId: msg.video.id,
      mimeType: msg.video.mime_type,
    };
  }
  return null;
}

export async function processMetaWebhook(
  client: Client,
  env: Env,
  ctx: ExecutionContext,
  body: string,
): Promise<void> {
  const payload = JSON.parse(body) as MetaPayload;
  if (payload.object !== "whatsapp_business_account") return;

  for (const entry of payload.entry ?? []) {
    for (const change of entry.changes ?? []) {
      const value = change.value;
      if (!value) continue;

      const phoneNumberId = value.metadata?.phone_number_id;
      if (!phoneNumberId) continue;

      const instance = await client.instancia.findFirst({
        where: { nuvemIdNumeroTelefone: phoneNumberId },
      });
      if (!instance) continue;

      for (const msg of value.messages ?? []) {
        let bodyText: string | null = null;
        let type = msg.type;
        const mediaInfo = metaMediaFromMessage(msg);

        if (msg.type === "text" && msg.text) {
          bodyText = msg.text.body;
        } else if (mediaInfo) {
          type = mediaInfo.type;
          bodyText = mediaInfo.body;
        } else {
          bodyText = `[${msg.type}]`;
        }
        if (!bodyText) continue;

        const result = await ingestInboundMessage(client, {
          instanciaId: instance.id,
          phone: msg.from,
          contactName: null,
          body: bodyText,
          type,
          externalId: msg.id,
          isCloud: true,
        });
        if (!result) continue;

        if (
          mediaInfo &&
          MEDIA_TYPES.has(type) &&
          instance.nuvemTokenAcesso &&
          instance.nuvemIdNumeroTelefone &&
          instance.nuvemIdWaba
        ) {
          scheduleInboundMedia(ctx, env, client, {
            provider: "meta",
            instanceUuid: instance.uuid,
            messageId: result.messageId,
            externalId: msg.id,
            type,
            accessToken: instance.nuvemTokenAcesso,
            phoneNumberId: instance.nuvemIdNumeroTelefone,
            wabaId: instance.nuvemIdWaba,
            mediaId: mediaInfo.mediaId,
            mimeType: mediaInfo.mimeType,
            fileName: mediaInfo.fileName,
          });
        }
      }

      for (const status of value.statuses ?? []) {
        const message = await client.mensagem.findFirst({
          where: { idExterno: status.id },
        });
        if (message) {
          await client.mensagem.update({
            where: { id: message.id },
            data: { status: status.status },
          });
        }
      }
    }
  }
}

async function ingestInboundMessage(
  client: Client,
  params: {
    instanciaId: number;
    phone: string;
    contactName: string | null;
    body: string;
    type: string;
    externalId: string | null;
    isCloud: boolean;
  },
): Promise<{ messageId: number } | null> {
  let contact = await client.contato.findFirst({
    where: { instanciaId: params.instanciaId, telefone: params.phone },
  });
  if (!contact) {
    contact = await client.contato.create({
      data: appCreateData({
        instanciaId: params.instanciaId,
        telefone: params.phone,
        nome: params.contactName,
      }),
    });
  }

  let conversation = await client.conversa.findFirst({
    where: { instanciaId: params.instanciaId, contatoId: contact.id, status: "open" },
  });
  if (!conversation) {
    conversation = await client.conversa.create({
      data: appCreateData({
        instanciaId: params.instanciaId,
        contatoId: contact.id,
        ultimaMensagemEm: new Date(),
        ...(params.isCloud
          ? { nuvemJanelaExpiraEm: new Date(Date.now() + 24 * 60 * 60 * 1000) }
          : {}),
      }),
    });
  } else if (params.isCloud) {
    await client.conversa.update({
      where: { id: conversation.id },
      data: { nuvemJanelaExpiraEm: new Date(Date.now() + 24 * 60 * 60 * 1000) },
    });
  }

  const existing = params.externalId
    ? await client.mensagem.findFirst({ where: { idExterno: params.externalId } })
    : null;
  if (existing) return null;

  const message = await client.mensagem.create({
    data: appCreateData({
      conversaId: conversation.id,
      direcao: "inbound",
      tipo: params.type,
      corpo: params.body,
      idExterno: params.externalId,
      status: "delivered",
    }),
  });

  await client.conversa.update({
    where: { id: conversation.id },
    data: { ultimaMensagemEm: new Date() },
  });

  const anoMes = new Date().toISOString().slice(0, 7);
  const usageContact = await client.usoMensalContato.findFirst({
    where: { instanciaId: params.instanciaId, contatoId: contact.id, anoMes },
  });
  if (!usageContact) {
    await client.usoMensalContato.create({
      data: appCreateData({
        instanciaId: params.instanciaId,
        contatoId: contact.id,
        anoMes,
        contadoEm: new Date(),
      }),
    });
    const usage = await client.usoMensal.findFirst({
      where: { instanciaId: params.instanciaId, anoMes },
    });
    if (usage) {
      await client.usoMensal.update({
        where: { id: usage.id },
        data: { contatosUnicosContagem: usage.contatosUnicosContagem + 1 },
      });
    } else {
      await client.usoMensal.create({
        data: appCreateData({
          instanciaId: params.instanciaId,
          anoMes,
          contatosUnicosContagem: 1,
        }),
      });
    }
  }

  return { messageId: message.id };
}
