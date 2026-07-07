/**
 * Processadores de webhooks Evolution e Meta Cloud API.
 * Cria/atualiza contato, conversa, mensagem e contagem de uso mensal.
 * Mensagens com mídia disparam download assíncrono via `scheduleInboundMedia`.
 */
import {
  colunasContatoCaixaEntrada,
  colunasInstanciaWebhook,
  colunasMensagemWebhook,
  colunasSomenteId,
  colunasUsoMensal,
  colunasUsoMensalContato,
  comCriadoEm,
  comTimestampAtualizacao,
  comTimestampsCriacao,
  contato,
  conversa,
  type Db,
  instancia,
  mensagem,
  usoMensal,
  usoMensalContato,
} from "@whasap/db";
import type { WorkerExecutionContext } from "@whasap/evlog/workers";
import { and, eq, isNull, or } from "drizzle-orm";
import type { Env } from "./env";
import { scheduleInboundMedia } from "./media";

type EvolutionPayload = {
  event?: string;
  instance?: string;
  instanceId?: string;
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

async function buscarInstanciaEvolution(db: Db, payload: EvolutionPayload) {
  const instanceKey = payload.instance;
  const instanceId = payload.instanceId;

  if (instanceId) {
    return db.query.instancia.findFirst({
      where: and(eq(instancia.evolucaoInstanceId, instanceId), isNull(instancia.excluidoEm)),
      columns: colunasInstanciaWebhook,
    });
  }
  if (instanceKey) {
    return db.query.instancia.findFirst({
      where: and(
        or(
          eq(instancia.evolucaoNomeInstancia, instanceKey),
          eq(instancia.evolucaoInstanceId, instanceKey),
        ),
        isNull(instancia.excluidoEm),
      ),
      columns: colunasInstanciaWebhook,
    });
  }
  return null;
}

/**
 * Processa eventos Evolution (connection.update, messages.upsert, etc.).
 * Idempotente por `idExterno` da mensagem.
 */
export async function processEvolutionWebhook(
  db: Db,
  env: Env,
  ctx: WorkerExecutionContext,
  body: string,
): Promise<void> {
  const payload = JSON.parse(body) as EvolutionPayload;
  const event = payload.event ?? "";

  const instance = await buscarInstanciaEvolution(db, payload);
  if (!instance) return;

  if (event === "connection.update") {
    const state = payload.data?.state;
    if (state === "open") {
      await db
        .update(instancia)
        .set(
          comTimestampAtualizacao({
            status: instance.asaasIdAssinatura ? "connected" : "pending_payment",
            conectadoEm: new Date(),
          }),
        )
        .where(eq(instancia.id, instance.id));
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

  const result = await ingerirMensagemEntrada(db, {
    instanciaId: instance.id,
    phone,
    contactName: pushName ?? null,
    body: bodyText,
    type,
    externalId: messageId,
    isCloud: false,
  });
  if (!result) return;

  if (mediaInfo && MEDIA_TYPES.has(type) && instance.evolucaoToken) {
    scheduleInboundMedia(ctx, env, db, {
      provider: "evolution",
      instanceUuid: instance.uuid,
      messageId: result.messageId,
      externalId: messageId,
      type,
      instanceToken: instance.evolucaoToken!,
      messageKey,
      waMessage: messageObj,
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

type MetaChangeValue = {
  metadata?: { phone_number_id?: string };
  messages?: MetaMessage[];
  statuses?: Array<{ id: string; status: string }>;
};

type MetaPayload = {
  object?: string;
  entry?: Array<{
    changes?: Array<{
      value?: MetaChangeValue;
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

async function findMetaWebhookInstance(db: Db, phoneNumberId: string) {
  return db.query.instancia.findFirst({
    where: and(eq(instancia.nuvemIdNumeroTelefone, phoneNumberId), isNull(instancia.excluidoEm)),
    columns: colunasInstanciaWebhook,
  });
}

type MetaWebhookInstance = NonNullable<Awaited<ReturnType<typeof findMetaWebhookInstance>>>;

/**
 * Processa eventos Meta Cloud API (mensagens inbound e status de entrega).
 */
export async function processMetaWebhook(
  db: Db,
  env: Env,
  ctx: WorkerExecutionContext,
  body: string,
): Promise<void> {
  const payload = JSON.parse(body) as MetaPayload;
  if (payload.object !== "whatsapp_business_account") return;

  const changeValues = (payload.entry ?? []).flatMap((entry) =>
    (entry.changes ?? []).flatMap((change) => (change.value ? [change.value] : [])),
  );
  if (changeValues.length === 0) return;

  const phoneNumberIds = [
    ...new Set(
      changeValues
        .map((value) => value.metadata?.phone_number_id)
        .filter((id): id is string => Boolean(id)),
    ),
  ];

  const instanceRows = await Promise.all(
    phoneNumberIds.map((phoneNumberId) => findMetaWebhookInstance(db, phoneNumberId)),
  );
  const instanceByPhoneNumberId = new Map(
    phoneNumberIds.map((phoneNumberId, index) => [phoneNumberId, instanceRows[index]] as const),
  );

  await Promise.all(
    changeValues.map((value) =>
      processMetaChangeValue(db, env, ctx, value, instanceByPhoneNumberId),
    ),
  );
}

async function processMetaChangeValue(
  db: Db,
  env: Env,
  ctx: WorkerExecutionContext,
  value: MetaChangeValue,
  instanceByPhoneNumberId: Map<string, MetaWebhookInstance | undefined>,
): Promise<void> {
  const phoneNumberId = value.metadata?.phone_number_id;
  if (!phoneNumberId) return;

  const instance = instanceByPhoneNumberId.get(phoneNumberId);
  if (!instance) return;

  await Promise.all(
    (value.messages ?? []).map((msg) => processMetaInboundMessage(db, env, ctx, instance, msg)),
  );

  await Promise.all((value.statuses ?? []).map((status) => processMetaDeliveryStatus(db, status)));
}

async function processMetaInboundMessage(
  db: Db,
  env: Env,
  ctx: WorkerExecutionContext,
  instance: MetaWebhookInstance,
  msg: MetaMessage,
): Promise<void> {
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
  if (!bodyText) return;

  const result = await ingerirMensagemEntrada(db, {
    instanciaId: instance.id,
    phone: msg.from,
    contactName: null,
    body: bodyText,
    type,
    externalId: msg.id,
    isCloud: true,
  });
  if (!result) return;

  if (
    mediaInfo &&
    MEDIA_TYPES.has(type) &&
    instance.nuvemTokenAcesso &&
    instance.nuvemIdNumeroTelefone &&
    instance.nuvemIdWaba
  ) {
    scheduleInboundMedia(ctx, env, db, {
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

async function processMetaDeliveryStatus(
  db: Db,
  status: { id: string; status: string },
): Promise<void> {
  const message = await db.query.mensagem.findFirst({
    where: and(eq(mensagem.idExterno, status.id), isNull(mensagem.excluidoEm)),
    columns: colunasMensagemWebhook,
  });
  if (!message) return;

  await db.update(mensagem).set({ status: status.status }).where(eq(mensagem.id, message.id));
}

/**
 * Persiste mensagem inbound: contato, conversa, mensagem e uso mensal.
 * Idempotente por `externalId` quando informado.
 */
async function ingerirMensagemEntrada(
  db: Db,
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
  let contact = await db.query.contato.findFirst({
    where: and(
      eq(contato.instanciaId, params.instanciaId),
      eq(contato.telefone, params.phone),
      isNull(contato.excluidoEm),
    ),
    columns: colunasContatoCaixaEntrada,
  });
  if (!contact) {
    [contact] = await db
      .insert(contato)
      .values(
        comTimestampsCriacao({
          instanciaId: params.instanciaId,
          telefone: params.phone,
          nome: params.contactName,
        }),
      )
      .returning();
  }

  let conversation = await db.query.conversa.findFirst({
    where: and(
      eq(conversa.instanciaId, params.instanciaId),
      eq(conversa.contatoId, contact!.id),
      eq(conversa.status, "open"),
      isNull(conversa.excluidoEm),
    ),
    columns: colunasSomenteId,
  });
  if (!conversation) {
    [conversation] = await db
      .insert(conversa)
      .values(
        comTimestampsCriacao({
          instanciaId: params.instanciaId,
          contatoId: contact!.id,
          ultimaMensagemEm: new Date(),
          ...(params.isCloud
            ? { nuvemJanelaExpiraEm: new Date(Date.now() + 24 * 60 * 60 * 1000) }
            : {}),
        }),
      )
      .returning();
  } else if (params.isCloud) {
    await db
      .update(conversa)
      .set(
        comTimestampAtualizacao({
          nuvemJanelaExpiraEm: new Date(Date.now() + 24 * 60 * 60 * 1000),
        }),
      )
      .where(eq(conversa.id, conversation.id));
  }

  const existing = params.externalId
    ? await db.query.mensagem.findFirst({
        where: and(eq(mensagem.idExterno, params.externalId), isNull(mensagem.excluidoEm)),
        columns: colunasSomenteId,
      })
    : null;
  if (existing) return null;

  const [message] = await db
    .insert(mensagem)
    .values(
      comCriadoEm({
        conversaId: conversation!.id,
        direcao: "inbound",
        tipo: params.type,
        corpo: params.body,
        idExterno: params.externalId,
        status: "delivered",
      }),
    )
    .returning();

  await db
    .update(conversa)
    .set(comTimestampAtualizacao({ ultimaMensagemEm: new Date() }))
    .where(eq(conversa.id, conversation!.id));

  const anoMes = new Date().toISOString().slice(0, 7);
  const usageContact = await db.query.usoMensalContato.findFirst({
    where: and(
      eq(usoMensalContato.instanciaId, params.instanciaId),
      eq(usoMensalContato.contatoId, contact!.id),
      eq(usoMensalContato.anoMes, anoMes),
    ),
    columns: colunasUsoMensalContato,
  });
  if (!usageContact) {
    await db.insert(usoMensalContato).values({
      instanciaId: params.instanciaId,
      contatoId: contact!.id,
      anoMes,
      contadoEm: new Date(),
    });
    const usage = await db.query.usoMensal.findFirst({
      where: and(eq(usoMensal.instanciaId, params.instanciaId), eq(usoMensal.anoMes, anoMes)),
      columns: colunasUsoMensal,
    });
    if (usage) {
      await db
        .update(usoMensal)
        .set({
          contatosUnicosContagem: usage.contatosUnicosContagem + 1,
          atualizadoEm: new Date(),
        })
        .where(eq(usoMensal.id, usage.id));
    } else {
      await db.insert(usoMensal).values({
        instanciaId: params.instanciaId,
        anoMes,
        contatosUnicosContagem: 1,
        atualizadoEm: new Date(),
      });
    }
  }

  return { messageId: message!.id };
}
