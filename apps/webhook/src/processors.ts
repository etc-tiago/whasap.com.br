/**
 * Processadores de webhooks Evolution e Meta Cloud API.
 */
import { atualizarStatusMensagemPorIdExterno } from "@whasap/api-core";
import {
  incluirInstanciaWebhook,
  instanciaMetaCloud,
  type Db,
} from "@whasap/db";
import type { WorkerExecutionContext } from "@whasap/evlog/workers";
import {
  metaMessageTemMidia,
  metaMidiaDeMetadados,
  parseMetaMessage,
  parseMetaStatus,
  parseMetaWebhook,
  resolverIdExternoCanonicoMeta,
  type MetaWebhookChange,
} from "@whasap/meta";
import { eq } from "drizzle-orm";

import { processEvolutionGoWebhook } from "./evolution-go-processor";
import type { Env } from "./env";
import { ingerirMensagem } from "./ingestao-mensagem";
import { scheduleInboundMedia } from "./media";

type MetaWebhookInstance = NonNullable<Awaited<ReturnType<typeof findMetaWebhookInstance>>>;

const META_MEDIA_TYPES = new Set(["image", "audio", "document", "video", "sticker"]);

async function findMetaWebhookInstance(db: Db, phoneNumberId: string) {
  const metaRow = await db.query.instanciaMetaCloud.findFirst({
    where: eq(instanciaMetaCloud.phoneNumberId, phoneNumberId),
    with: {
      instancia: incluirInstanciaWebhook,
    },
  });
  return metaRow?.instancia ?? null;
}

/** Processa eventos Evolution GO e legado Baileys. */
export async function processEvolutionWebhook(
  db: Db,
  env: Env,
  ctx: WorkerExecutionContext,
  body: string,
): Promise<void> {
  await processEvolutionGoWebhook(db, env, ctx, body);
}

/** Processa eventos Meta Cloud API (mensagens inbound e status de entrega). */
export async function processMetaWebhook(
  db: Db,
  env: Env,
  ctx: WorkerExecutionContext,
  body: string,
): Promise<void> {
  const payload = JSON.parse(body) as unknown;
  const changes = parseMetaWebhook(payload);
  if (changes.length === 0) return;

  const phoneNumberIds = [...new Set(changes.map((change) => change.phoneNumberId))];
  const instanceRows = await Promise.all(
    phoneNumberIds.map((phoneNumberId) => findMetaWebhookInstance(db, phoneNumberId)),
  );
  const instanceByPhoneNumberId = new Map(
    phoneNumberIds.map((phoneNumberId, index) => [phoneNumberId, instanceRows[index]] as const),
  );

  await Promise.all(
    changes.map((change) => processMetaChange(db, env, ctx, change, instanceByPhoneNumberId)),
  );
}

async function processMetaChange(
  db: Db,
  env: Env,
  ctx: WorkerExecutionContext,
  change: MetaWebhookChange,
  instanceByPhoneNumberId: Map<string, MetaWebhookInstance | null | undefined>,
): Promise<void> {
  const instance = instanceByPhoneNumberId.get(change.phoneNumberId);
  if (!instance) return;

  const contactNameByWaId = new Map(
    change.contacts.map((contact) => [contact.waId, contact.name] as const),
  );

  await Promise.all(
    change.messages.map((msg) =>
      processMetaInboundMessage(db, env, ctx, instance, msg, contactNameByWaId),
    ),
  );

  await Promise.all(change.statuses.map((status) => processMetaDeliveryStatus(db, status)));
}

async function processMetaInboundMessage(
  db: Db,
  env: Env,
  ctx: WorkerExecutionContext,
  instance: MetaWebhookInstance,
  msg: Record<string, unknown>,
  contactNameByWaId: Map<string, string | null>,
): Promise<void> {
  const parsed = parseMetaMessage(msg);
  if (!parsed || !parsed.body) return;

  const metaCloud = instance.metaCloud;
  const result = await ingerirMensagem(db, {
    instanciaId: instance.id,
    organizacaoId: instance.organizacaoId,
    phone: parsed.phone,
    contactName: contactNameByWaId.get(parsed.phone) ?? null,
    idExternoLinha: parsed.phone,
    idExternoCanonico: resolverIdExternoCanonicoMeta(parsed.phone),
    body: parsed.body,
    type: parsed.type,
    externalId: parsed.externalId,
    provedor: "meta_cloud",
    naoLidasDelta: 1,
    enviadoEm: parsed.timestamp ?? undefined,
    metadados: parsed.metadados,
  });
  if (!result) return;
  if (!result.created && result.midiaR2Chave) return;

  const mediaInfo = metaMidiaDeMetadados(parsed.metadados);
  if (
    mediaInfo &&
    metaMessageTemMidia(parsed.type) &&
    META_MEDIA_TYPES.has(parsed.type) &&
    metaCloud?.accessToken &&
    metaCloud.phoneNumberId &&
    metaCloud.wabaId
  ) {
    scheduleInboundMedia(ctx, env, {
      provider: "meta_cloud",
      instanceUuid: instance.uuid,
      messageId: result.messageId,
      externalId: parsed.externalId,
      type: parsed.type,
      accessToken: metaCloud.accessToken,
      phoneNumberId: metaCloud.phoneNumberId,
      wabaId: metaCloud.wabaId,
      mediaId: mediaInfo.mediaId,
      mimeType: mediaInfo.mimeType,
      fileName: mediaInfo.fileName,
    });
  }
}

async function processMetaDeliveryStatus(db: Db, status: Record<string, unknown>): Promise<void> {
  const parsed = parseMetaStatus(status);
  if (!parsed) return;

  await atualizarStatusMensagemPorIdExterno(db, parsed.externalId, parsed.status);
}
