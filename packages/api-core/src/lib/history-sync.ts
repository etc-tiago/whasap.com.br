/**
 * Processa chunk HistorySync: ingere mensagens em ordem cronológica por conversa.
 * Conclusão: só syncType RECENT @ 100%, ou idle sem chunks (`concluirHistoricosSyncOciosos`).
 * Mídia: retorna jobs para o worker baixar (Evolution downloadmedia) após a ingestão.
 */
import {
  deveIgnorarHistorySyncChunk,
  HISTORY_SYNC_TYPE,
  historySyncConcluido,
  mapaLidParaPn,
  parseGoHistorySyncChunk,
  resolverJidHistoricoSync,
  rotuloHistorySyncType,
} from "@whasap/evolution";
import { comTimestampAtualizacao, type Db, instanciaEvo } from "@whasap/db";
import { and, eq, isNotNull, lt, or } from "drizzle-orm";

import { ingerirMensagem } from "./ingestao-mensagem";
import type { JobMidiaInbound } from "./midia-inbound";

export type InstanciaParaHistorySync = {
  id: number;
  organizacaoId: number;
  uuid: string;
  evoToken?: string | null;
};

const TIPOS_MIDIA = new Set(["image", "audio", "document", "video", "sticker"]);

/** Sem novos chunks úteis por este intervalo → marcar completed (conta grande / RECENT incompleto). */
export const HISTORICO_SYNC_IDLE_MS = 5 * 60 * 1000;

/** Concorrência padrão ao baixar mídias de um chunk no worker. */
export const HISTORY_SYNC_MIDIA_CONCORRENCIA = 4;

/** Particiona jobs de mídia em lotes de tamanho fixo. */
export function particionarEmLotes<T>(items: readonly T[], tamanho: number): T[][] {
  if (tamanho <= 0) return items.length ? [[...items]] : [];
  const lotes: T[][] = [];
  for (let i = 0; i < items.length; i += tamanho) {
    lotes.push(items.slice(i, i + tamanho));
  }
  return lotes;
}

export type AcaoHistorySyncEnqueue =
  | { tipo: "ignorar"; atualizarProgresso: boolean }
  | { tipo: "enfileirar" }
  | { tipo: "falha_sem_fila" };

/** Tentativas da fila Cloudflare antes de marcar sync failed. */
export const HISTORY_SYNC_FILA_MAX_TENTATIVAS = 5;

/** Chave R2 do chunk enfileirado para o worker history-sync. */
export function montarChaveR2HistoricoSync(
  instanciaUuid: string,
  diaIso: string,
  id: string = crypto.randomUUID(),
): string {
  return `historico-sync/${instanciaUuid}/${diaIso}/${id}.json`;
}

/** Apos N tentativas da queue, ack + marcar failed (em vez de retry infinito). */
export function deveMarcarFalhaAposTentativasFila(attempts: number): boolean {
  return attempts >= HISTORY_SYNC_FILA_MAX_TENTATIVAS;
}

/**
 * Patch aplicado em `instancia_evo` por {@link atualizarProgressoHistoricoSync}.
 * Exportado para testes do contrato de status.
 */
export function montarPatchProgressoHistoricoSync(params: {
  status?: "idle" | "requested" | "running" | "completed" | "failed";
  progress?: number | null;
  erro?: string | null;
  marcarConcluido?: boolean;
  heartbeat?: boolean;
  agora?: Date;
}): Record<string, unknown> | null {
  const agora = params.agora ?? new Date();
  const patch: Record<string, unknown> = {};
  if (params.status !== undefined) patch.historicoSyncStatus = params.status;
  if (params.progress !== undefined) patch.historicoSyncProgress = params.progress;
  if (params.erro !== undefined) patch.historicoSyncErro = params.erro;
  if (params.heartbeat) patch.historicoSincronizandoEm = agora;
  if (params.marcarConcluido) {
    patch.historicoSyncStatus = "completed";
    patch.historicoSincronizadoEm = agora;
    patch.historicoSincronizandoEm = null;
    patch.historicoSyncErro = null;
  }
  return Object.keys(patch).length === 0 ? null : patch;
}

/**
 * Decide o que o webhook faz com um chunk HistorySync parseado.
 * On-demand nao marca failed/running na instancia (sync completo da conta).
 */
export function decidirAcaoHistorySyncEnqueue(
  chunk: {
    syncType: number;
    temMensagens: boolean;
  },
  temFila: boolean,
): AcaoHistorySyncEnqueue {
  const onDemand = chunk.syncType === HISTORY_SYNC_TYPE.ON_DEMAND;
  const ignorar = chunk.syncType === HISTORY_SYNC_TYPE.NON_BLOCKING_DATA || !chunk.temMensagens;
  if (ignorar) {
    return { tipo: "ignorar", atualizarProgresso: !onDemand };
  }
  if (!temFila) {
    return onDemand ? { tipo: "ignorar", atualizarProgresso: false } : { tipo: "falha_sem_fila" };
  }
  return { tipo: "enfileirar" };
}

/** Atualiza progresso/status leve sem ingerir mensagens. */
export async function atualizarProgressoHistoricoSync(
  db: Db,
  instanciaId: number,
  params: {
    status?: "idle" | "requested" | "running" | "completed" | "failed";
    progress?: number | null;
    erro?: string | null;
    marcarConcluido?: boolean;
    /** Renova `historicoSincronizandoEm` (atividade recente). */
    heartbeat?: boolean;
  },
): Promise<void> {
  const patch = montarPatchProgressoHistoricoSync(params);
  if (!patch) return;

  await db
    .update(instanciaEvo)
    .set(comTimestampAtualizacao(patch as never))
    .where(eq(instanciaEvo.instanciaId, instanciaId));
}

/**
 * Marca como completed syncs `requested`/`running` sem heartbeat há {@link HISTORICO_SYNC_IDLE_MS}.
 * @returns quantas instâncias foram concluídas por idle.
 */
export async function concluirHistoricosSyncOciosos(
  db: Db,
  agora: Date = new Date(),
): Promise<number> {
  const limite = new Date(agora.getTime() - HISTORICO_SYNC_IDLE_MS);
  const rows = await db.query.instanciaEvo.findMany({
    where: and(
      or(
        eq(instanciaEvo.historicoSyncStatus, "requested"),
        eq(instanciaEvo.historicoSyncStatus, "running"),
      ),
      isNotNull(instanciaEvo.historicoSincronizandoEm),
      lt(instanciaEvo.historicoSincronizandoEm, limite),
    ),
    columns: { instanciaId: true },
  });

  await Promise.all(
    rows.map((row) =>
      atualizarProgressoHistoricoSync(db, row.instanciaId, { marcarConcluido: true }),
    ),
  );
  return rows.length;
}

function mimeDeMessageObj(messageObj: Record<string, unknown>): string | undefined {
  for (const key of [
    "imageMessage",
    "videoMessage",
    "audioMessage",
    "documentMessage",
    "stickerMessage",
  ] as const) {
    const part = messageObj[key] as { mimetype?: string; fileName?: string } | undefined;
    if (part?.mimetype) return part.mimetype;
  }
  return undefined;
}

function fileNameDeMessageObj(messageObj: Record<string, unknown>): string | undefined {
  const doc = messageObj.documentMessage as { fileName?: string } | undefined;
  return doc?.fileName;
}

/**
 * Ingere um chunk HistorySync já parseado (ou raw).
 * Mensagens de cada conversa são processadas em ordem cronológica, em série.
 * Jobs de mídia (sem midiaR2Chave) são retornados para o worker persistir no CDN.
 */
export async function processarHistorySyncChunk(
  db: Db,
  instance: InstanciaParaHistorySync,
  data: Record<string, unknown>,
): Promise<{
  ignorado: boolean;
  concluido: boolean;
  progress: number;
  midiaJobs: JobMidiaInbound[];
}> {
  const chunk = parseGoHistorySyncChunk(data);

  if (deveIgnorarHistorySyncChunk(chunk)) {
    return { ignorado: true, concluido: false, progress: chunk.progress ?? 0, midiaJobs: [] };
  }

  const onDemand = chunk.syncType === HISTORY_SYNC_TYPE.ON_DEMAND;
  if (!onDemand) {
    await atualizarProgressoHistoricoSync(db, instance.id, {
      status: "running",
      progress: chunk.progress,
      erro: null,
      heartbeat: true,
    });
  }

  const lidParaPn = mapaLidParaPn(chunk.phoneLidMappings);
  const midiaJobs: JobMidiaInbound[] = [];
  const evoToken = instance.evoToken;

  // Ingest sequencial por conversa/timestamp — paralelo bagunça ultimaMensagemEm.
  const pendentes: Array<() => Promise<void>> = [];
  for (const conv of chunk.conversations) {
    const { idExternoLinha, idExternoCanonico, phone } = resolverJidHistoricoSync(
      conv.jid,
      lidParaPn,
    );

    const mensagensOrdenadas = [...conv.messages].toSorted((a, b) => {
      const ta = a.timestamp?.getTime() ?? 0;
      const tb = b.timestamp?.getTime() ?? 0;
      return ta - tb;
    });

    for (const msg of mensagensOrdenadas) {
      const direcao = msg.fromMe ? "outbound" : "inbound";
      const isMidia = TIPOS_MIDIA.has(msg.type);
      pendentes.push(async () => {
        const result = await ingerirMensagem(db, {
          instanciaId: instance.id,
          organizacaoId: instance.organizacaoId,
          phone,
          contactName: conv.nome,
          idExternoLinha,
          idExternoCanonico,
          body: msg.body,
          type: msg.type,
          externalId: msg.messageId,
          provedor: "evo",
          direcao,
          criadoEm: msg.timestamp ?? undefined,
          ultimaMensagemEm: msg.timestamp ?? undefined,
          naoLidasInicial: conv.unreadCount,
          metadados: {
            origemHistorico: true,
            syncType: chunk.syncType,
            syncFase: rotuloHistorySyncType(chunk.syncType),
            ...(isMidia ? { waMessage: msg.messageObj } : {}),
          },
          status: msg.status ?? (direcao === "outbound" ? "sent" : "delivered"),
        });

        if (!result || !isMidia || !evoToken) return;
        if (result.midiaR2Chave) return;

        midiaJobs.push({
          provider: "evo",
          instanceUuid: instance.uuid,
          messageId: result.messageId,
          externalId: msg.messageId,
          type: msg.type,
          instanceToken: evoToken,
          messageKey: {
            remoteJid: msg.chatJid,
            fromMe: msg.fromMe,
            id: msg.messageId,
          },
          waMessage: msg.messageObj,
          mimeType: mimeDeMessageObj(msg.messageObj),
          fileName: fileNameDeMessageObj(msg.messageObj),
        });
      });
    }
  }

  await pendentes.reduce<Promise<void>>((acc, run) => acc.then(run), Promise.resolve());

  const concluido = !onDemand && historySyncConcluido(chunk);
  if (concluido) {
    await atualizarProgressoHistoricoSync(db, instance.id, { marcarConcluido: true });
  }

  return { ignorado: false, concluido, progress: chunk.progress ?? 0, midiaJobs };
}
