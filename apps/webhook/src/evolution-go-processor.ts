/**
 * Processamento de webhooks Evolution GO (formato whatsmeow).
 */
import {
  atualizarProgressoHistoricoSync,
  marcarInstanciaConectadaEvolution,
  marcarInstanciaDesconectadaEvolution,
  solicitarHistoricoSyncSePrimeiraConexao,
} from "@whasap/api-core";
import {
  colunasContatoTag,
  colunasSomenteId,
  comCriadoEm,
  comTimestampAtualizacao,
  contato,
  contatoTag,
  contatoTagAtribuicao,
  conversa,
  type Db,
  instanciaEvo,
  incluirInstanciaWebhook,
} from "@whasap/db";
import type { WorkerExecutionContext } from "@whasap/evlog/workers";
import { log } from "@whasap/evlog";
import {
  deveIgnorarHistorySyncChunk,
  formatInteractiveResponseBody,
  HISTORY_SYNC_TYPE,
  indiceWhatsappParaCorPainel,
  jidParaIdExterno,
  jidParaTelefone,
  parseGoButtonClick,
  parseGoConnectionLifecycleEvent,
  parseGoHistorySyncChunk,
  parseGoLabelAssociation,
  parseGoMessageEvent,
  parseGoPairSuccess,
  parseGoPushName,
  parseGoReceipt,
  receiptIndicaLeitura,
  resolverIdExternoCanonicoGo,
  resolverInstanciaWebhookGo,
  telefoneExibicaoDeInfo,
  type EvolutionGoWebhookPayload,
} from "@whasap/evolution";
import { and, eq, isNull, or } from "drizzle-orm";

import type { Env } from "./env";
import {
  atualizarStatusMensagemPorIdExterno,
  buscarContatoPorIdExterno,
  decrementarNaoLidas,
  ingerirMensagem,
} from "./ingestao-mensagem";
import { scheduleInboundMedia } from "./media";

type InstanciaWebhook = NonNullable<Awaited<ReturnType<typeof buscarInstanciaEvolution>>>;

const MEDIA_TYPES = new Set(["image", "audio", "document", "video", "sticker"]);

type EvolutionMediaPart = {
  caption?: string;
  mimetype?: string;
  fileName?: string;
  base64?: string;
};

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
  if (messageObj.stickerMessage) {
    const part = messageObj.stickerMessage as EvolutionMediaPart;
    return {
      type: "sticker" as const,
      body: "[sticker]",
      mimeType: part.mimetype,
      base64: part.base64 ?? msgBase64,
      fileName: part.fileName,
    };
  }
  return null;
}

async function buscarInstanciaEvolution(db: Db, payload: EvolutionGoWebhookPayload) {
  const { instanceName, instanceId } = resolverInstanciaWebhookGo(payload);

  if (instanceId) {
    const evoRow = await db.query.instanciaEvo.findFirst({
      where: eq(instanciaEvo.instanceId, instanceId),
      with: { instancia: incluirInstanciaWebhook },
    });
    if (evoRow?.instancia) return evoRow.instancia;
  }

  if (instanceName) {
    const evoRow = await db.query.instanciaEvo.findFirst({
      where: or(
        eq(instanciaEvo.nomeInstancia, instanceName),
        eq(instanciaEvo.instanceId, instanceName),
      ),
      with: { instancia: incluirInstanciaWebhook },
    });
    if (evoRow?.instancia) return evoRow.instancia;
  }

  return null;
}

function identidadeGoDeInfo(
  info: Record<string, unknown>,
  chatJid: string,
): { idExternoLinha: string; idExternoCanonico: string; phone: string } {
  const idExternoLinha = jidParaIdExterno(chatJid);
  const idExternoCanonico = resolverIdExternoCanonicoGo(info);
  const phone = telefoneExibicaoDeInfo(info) ?? jidParaTelefone(chatJid);
  return { idExternoLinha, idExternoCanonico, phone };
}

async function processarMensagemGo(
  db: Db,
  env: Env,
  ctx: WorkerExecutionContext,
  instance: InstanciaWebhook,
  data: Record<string, unknown>,
  direcaoPadrao: "inbound" | "outbound",
): Promise<void> {
  const parsed = parseGoMessageEvent(data);
  if (!parsed) return;

  const info = (data.Info ?? {}) as Record<string, unknown>;
  const { idExternoLinha, idExternoCanonico, phone } = identidadeGoDeInfo(info, parsed.chatJid);
  const direcao = parsed.fromMe ? "outbound" : direcaoPadrao;

  const mediaInfo = MEDIA_TYPES.has(parsed.type)
    ? evolutionMediaFromMessage(parsed.messageObj)
    : null;

  const result = await ingerirMensagem(db, {
    instanciaId: instance.id,
    organizacaoId: instance.organizacaoId,
    phone,
    contactName: parsed.pushName,
    idExternoLinha,
    idExternoCanonico,
    body: parsed.body,
    type: parsed.type,
    externalId: parsed.messageId,
    provedor: "evo",
    direcao,
    criadoEm: parsed.timestamp ?? undefined,
    ultimaMensagemEm: parsed.timestamp ?? undefined,
    naoLidasDelta: direcao === "inbound" ? 1 : 0,
    metadados: {
      origemGo: true,
      isGroup: parsed.isGroup,
      ...(mediaInfo ? { waMessage: parsed.messageObj } : {}),
    },
    status: direcao === "outbound" ? "sent" : "delivered",
  });

  if (!result || !mediaInfo) return;
  // Duplicata já com mídia: nada a fazer (e não reincrementa uso — early return da ingestão).
  if (!result.created && result.midiaR2Chave) return;

  const evoToken = instance.evo?.token;
  // base64 inline não precisa de token; download via API precisa.
  if (!mediaInfo.base64 && !evoToken) return;

  scheduleInboundMedia(ctx, env, {
    provider: "evo",
    instanceUuid: instance.uuid,
    messageId: result.messageId,
    externalId: parsed.messageId,
    type: parsed.type,
    instanceToken: evoToken ?? "",
    messageKey: {
      remoteJid: parsed.chatJid,
      fromMe: parsed.fromMe,
      id: parsed.messageId,
    },
    waMessage: parsed.messageObj,
    mimeType: mediaInfo.mimeType,
    base64: mediaInfo.base64,
    fileName: mediaInfo.fileName,
  });
}

async function enfileirarHistorySyncGo(
  db: Db,
  env: Env,
  instance: InstanciaWebhook,
  data: Record<string, unknown>,
): Promise<void> {
  const chunk = parseGoHistorySyncChunk(data);
  const onDemand = chunk.syncType === HISTORY_SYNC_TYPE.ON_DEMAND;

  if (deveIgnorarHistorySyncChunk(chunk)) {
    if (!onDemand) {
      await atualizarProgressoHistoricoSync(db, instance.id, {
        status: "running",
        progress: chunk.progress,
      });
    }
    return;
  }

  if (!env.HISTORY_SYNC_QUEUE) {
    log.error({
      contexto: "webhook.history_sync",
      erro: "Fila HISTORY_SYNC_QUEUE não configurada",
      instanciaUuid: instance.uuid,
    });
    if (!onDemand) {
      await atualizarProgressoHistoricoSync(db, instance.id, {
        status: "failed",
        erro: "Fila HISTORY_SYNC_QUEUE não configurada",
      });
    }
    return;
  }

  const date = new Date().toISOString().slice(0, 10);
  const r2Key = `historico-sync/${instance.uuid}/${date}/${crypto.randomUUID()}.json`;
  await env.R2.put(r2Key, JSON.stringify(data), {
    httpMetadata: { contentType: "application/json" },
  });

  await env.HISTORY_SYNC_QUEUE.send({
    instanciaUuid: instance.uuid,
    r2Key,
    receivedAt: new Date().toISOString(),
  });

  if (!onDemand) {
    await atualizarProgressoHistoricoSync(db, instance.id, {
      status: "running",
      progress: chunk.progress,
      erro: null,
      heartbeat: true,
    });
  }
}

async function marcarConectadaEPedirHistorico(
  db: Db,
  env: Env,
  instance: InstanciaWebhook,
): Promise<void> {
  await marcarInstanciaConectadaEvolution(db, {
    instanciaIdInterno: instance.id,
    orgIdInterno: instance.organizacaoId,
    asaasIdAssinatura: instance.asaasIdAssinatura,
  });
  try {
    await solicitarHistoricoSyncSePrimeiraConexao(db, env, instance.id, instance.uuid);
  } catch (err) {
    log.error({
      contexto: "webhook.history_sync_auto",
      instanciaUuid: instance.uuid,
      erro: err instanceof Error ? err.message : String(err),
    });
  }
}

async function processarReceiptGo(
  db: Db,
  instance: InstanciaWebhook,
  payload: EvolutionGoWebhookPayload,
) {
  const receipt = parseGoReceipt(payload.data as Record<string, unknown>, payload.state);
  if (!receipt || !receiptIndicaLeitura(receipt)) return;

  const status = receipt.type.includes("played") ? "played" : "read";

  await Promise.all(
    receipt.messageIds.map(async (messageId) => {
      const conversaId = await atualizarStatusMensagemPorIdExterno(db, messageId, status);

      if (receipt.fromMe && conversaId) return;

      if (conversaId) {
        await decrementarNaoLidas(db, conversaId, 1);
        return;
      }

      const phone = jidParaTelefone(receipt.chatJid);
      const idExternoCanonico = resolverIdExternoCanonicoGo({ Chat: receipt.chatJid });
      const contact = await buscarContatoPorIdExterno(
        db,
        instance.organizacaoId,
        idExternoCanonico,
        phone,
      );
      if (!contact) return;

      const conv = await db.query.conversa.findFirst({
        where: and(
          eq(conversa.instanciaId, instance.id),
          eq(conversa.contatoId, contact.id),
          eq(conversa.status, "open"),
          isNull(conversa.excluidoEm),
        ),
        columns: colunasSomenteId,
      });
      if (conv) await decrementarNaoLidas(db, conv.id, 1);
    }),
  );
}

async function processarButtonClickGo(
  db: Db,
  instance: InstanciaWebhook,
  data: Record<string, unknown>,
): Promise<void> {
  const parsed = parseGoButtonClick(data);
  if (!parsed?.flowResponse) return;

  const jid =
    (typeof data.jid === "string" && data.jid) ||
    (typeof data.chat === "string" && data.chat) ||
    null;
  const phoneFromData = typeof data.phone === "string" ? data.phone : null;
  const phone = phoneFromData ?? (jid ? jidParaTelefone(jid) : null);
  if (!phone) return;

  const info = (data.Message as Record<string, unknown> | undefined)?.Info as
    | Record<string, unknown>
    | undefined;
  const chatJid = jid ?? `${phone.replace(/\D/g, "")}@s.whatsapp.net`;
  const { idExternoLinha, idExternoCanonico } = info
    ? identidadeGoDeInfo(info, chatJid)
    : {
        idExternoLinha: jidParaIdExterno(chatJid),
        idExternoCanonico: `${phone.replace(/\D/g, "")}@s.whatsapp.net`,
      };

  const externalId = parsed.idempotencyKey ?? parsed.flowToken;
  if (!externalId) return;

  await ingerirMensagem(db, {
    instanciaId: instance.id,
    organizacaoId: instance.organizacaoId,
    phone,
    contactName: typeof data.pushName === "string" ? data.pushName : null,
    idExternoLinha,
    idExternoCanonico,
    body: formatInteractiveResponseBody(parsed.flowResponse),
    type: "interactive",
    externalId,
    provedor: "evo",
    direcao: "inbound",
    criadoEm: parsed.timestamp ?? undefined,
    ultimaMensagemEm: parsed.timestamp ?? undefined,
    naoLidasDelta: 1,
    metadados: {
      origemGo: true,
      buttonClick: true,
      flowToken: parsed.flowToken,
      flowName: parsed.flowResponse.flowName,
    },
  });
}

async function processarPushNameGo(
  db: Db,
  instance: InstanciaWebhook,
  data: Record<string, unknown>,
): Promise<void> {
  const parsed = parseGoPushName(data);
  if (!parsed) return;

  const info = parsed.messageInfo?.Info as Record<string, unknown> | undefined;
  const chatJid = parsed.jid;
  const phone = parsed.jidAlt
    ? jidParaTelefone(parsed.jidAlt)
    : (telefoneExibicaoDeInfo(info ?? {}) ?? jidParaTelefone(chatJid));
  const idExternoCanonico = parsed.jidAlt ?? resolverIdExternoCanonicoGo(info ?? { Chat: chatJid });

  const contact = await buscarContatoPorIdExterno(
    db,
    instance.organizacaoId,
    idExternoCanonico,
    phone,
  );
  if (!contact) return;

  await db
    .update(contato)
    .set(comTimestampAtualizacao({ nome: parsed.newPushName }))
    .where(eq(contato.id, contact.id));
}

async function buscarOuCriarTagPorLabelId(db: Db, organizacaoId: number, labelId: string) {
  const existing = await db.query.contatoTag.findFirst({
    where: and(eq(contatoTag.organizacaoId, organizacaoId), eq(contatoTag.idExterno, labelId)),
    columns: colunasContatoTag,
  });
  if (existing) return existing;

  const [created] = await db
    .insert(contatoTag)
    .values(
      comCriadoEm({
        organizacaoId,
        nome: `Etiqueta ${labelId}`,
        cor: indiceWhatsappParaCorPainel(Number(labelId) % 10),
        idExterno: labelId,
      }),
    )
    .returning();
  return created!;
}

async function processarLabelAssociationGo(
  db: Db,
  instance: InstanciaWebhook,
  data: Record<string, unknown>,
) {
  const parsed = parseGoLabelAssociation(data);
  if (!parsed) return;

  const phone = jidParaTelefone(parsed.jid);
  const idExternoCanonico = parsed.jid.endsWith("@g.us")
    ? parsed.jid
    : resolverIdExternoCanonicoGo({ Chat: parsed.jid });
  const contact = await buscarContatoPorIdExterno(
    db,
    instance.organizacaoId,
    idExternoCanonico,
    phone,
  );
  if (!contact) return;

  const tag = await buscarOuCriarTagPorLabelId(db, instance.organizacaoId, parsed.labelId);

  if (parsed.labeled) {
    const existing = await db.query.contatoTagAtribuicao.findFirst({
      where: and(
        eq(contatoTagAtribuicao.contatoId, contact.id),
        eq(contatoTagAtribuicao.tagId, tag.id),
      ),
      columns: colunasSomenteId,
    });
    if (!existing) {
      await db.insert(contatoTagAtribuicao).values(
        comCriadoEm({
          contatoId: contact.id,
          tagId: tag.id,
        }),
      );
    }
    return;
  }

  await db
    .delete(contatoTagAtribuicao)
    .where(
      and(eq(contatoTagAtribuicao.contatoId, contact.id), eq(contatoTagAtribuicao.tagId, tag.id)),
    );
}

/** Processa webhook Evolution GO e legado Baileys. */
export async function processEvolutionGoWebhook(
  db: Db,
  env: Env,
  ctx: WorkerExecutionContext,
  body: string,
): Promise<void> {
  const payload = JSON.parse(body) as EvolutionGoWebhookPayload;
  const event = payload.event ?? "";

  const instance = await buscarInstanciaEvolution(db, payload);
  if (!instance) {
    const resolved = resolverInstanciaWebhookGo(payload);
    log.warn({
      contexto: "webhook.evo.instanciaNaoEncontrada",
      event,
      instanceName: resolved.instanceName,
      instanceId: resolved.instanceId,
    });
    return;
  }

  if (
    event === "connection.update" ||
    event === "Disconnected" ||
    event === "Connected" ||
    event === "LoggedOut"
  ) {
    const estado = parseGoConnectionLifecycleEvent(payload as never);
    if (estado === "open") {
      await marcarConectadaEPedirHistorico(db, env, instance);
    } else if (estado === "close") {
      await marcarInstanciaDesconectadaEvolution(db, instance.id);
    }
    return;
  }

  if (event === "PairSuccess") {
    const estado = parseGoPairSuccess((payload.data ?? {}) as Record<string, unknown>);
    if (estado === "open") {
      await marcarConectadaEPedirHistorico(db, env, instance);
    }
    return;
  }

  if (event === "Message") {
    await processarMensagemGo(
      db,
      env,
      ctx,
      instance,
      (payload.data ?? {}) as Record<string, unknown>,
      "inbound",
    );
    return;
  }

  if (event === "SendMessage") {
    await processarMensagemGo(
      db,
      env,
      ctx,
      instance,
      (payload.data ?? {}) as Record<string, unknown>,
      "outbound",
    );
    return;
  }

  if (event === "HistorySync") {
    await enfileirarHistorySyncGo(
      db,
      env,
      instance,
      (payload.data ?? {}) as Record<string, unknown>,
    );
    return;
  }

  if (event === "Receipt") {
    await processarReceiptGo(db, instance, payload);
    return;
  }

  if (event === "LabelAssociationChat") {
    await processarLabelAssociationGo(
      db,
      instance,
      (payload.data ?? {}) as Record<string, unknown>,
    );
    return;
  }

  if (event === "ButtonClick") {
    await processarButtonClickGo(db, instance, (payload.data ?? {}) as Record<string, unknown>);
    return;
  }

  if (event === "PushName") {
    await processarPushNameGo(db, instance, (payload.data ?? {}) as Record<string, unknown>);
    return;
  }

  if (event !== "messages.upsert" && event !== "MESSAGES_UPSERT") return;

  const legacyData = payload.data as {
    key?: { remoteJid?: string; fromMe?: boolean; id?: string };
    message?: Record<string, unknown>;
    pushName?: string;
  };

  const remoteJid = legacyData?.key?.remoteJid;
  const messageId = legacyData?.key?.id;
  if (!remoteJid || !messageId) return;

  await processarMensagemGo(
    db,
    env,
    ctx,
    instance,
    {
      Info: {
        Chat: remoteJid,
        ID: messageId,
        IsFromMe: legacyData.key?.fromMe ?? false,
        PushName: legacyData.pushName,
        IsGroup: remoteJid.endsWith("@g.us"),
      },
      Message: legacyData.message ?? {},
    },
    "inbound",
  );
}
