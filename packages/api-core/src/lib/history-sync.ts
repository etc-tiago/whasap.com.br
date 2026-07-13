/**
 * Processa chunk HistorySync: ingere mensagens em ordem cronológica por conversa.
 * Conclusão: só syncType RECENT @ 100%, ou idle sem chunks (`concluirHistoricosSyncOciosos`).
 */
import {
  deveIgnorarHistorySyncChunk,
  historySyncConcluido,
  mapaLidParaPn,
  parseGoHistorySyncChunk,
  resolverJidHistoricoSync,
  rotuloHistorySyncType,
} from "@whasap/evolution";
import { comTimestampAtualizacao, type Db, instanciaEvo } from "@whasap/db";
import { and, eq, isNotNull, lt, or } from "drizzle-orm";

import { ingerirMensagem } from "./ingestao-mensagem";

export type InstanciaParaHistorySync = {
  id: number;
  organizacaoId: number;
  uuid: string;
};

/** Sem novos chunks úteis por este intervalo → marcar completed (conta grande / RECENT incompleto). */
export const HISTORICO_SYNC_IDLE_MS = 5 * 60 * 1000;

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
  const patch: Record<string, unknown> = {};
  if (params.status !== undefined) patch.historicoSyncStatus = params.status;
  if (params.progress !== undefined) patch.historicoSyncProgress = params.progress;
  if (params.erro !== undefined) patch.historicoSyncErro = params.erro;
  if (params.heartbeat) patch.historicoSincronizandoEm = new Date();
  if (params.marcarConcluido) {
    patch.historicoSyncStatus = "completed";
    patch.historicoSincronizadoEm = new Date();
    patch.historicoSincronizandoEm = null;
    patch.historicoSyncErro = null;
  }
  if (Object.keys(patch).length === 0) return;

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

/**
 * Ingere um chunk HistorySync já parseado (ou raw).
 * Mensagens de cada conversa são processadas em ordem cronológica, em série.
 */
export async function processarHistorySyncChunk(
  db: Db,
  instance: InstanciaParaHistorySync,
  data: Record<string, unknown>,
): Promise<{ ignorado: boolean; concluido: boolean; progress: number }> {
  const chunk = parseGoHistorySyncChunk(data);

  if (deveIgnorarHistorySyncChunk(chunk)) {
    return { ignorado: true, concluido: false, progress: chunk.progress ?? 0 };
  }

  await atualizarProgressoHistoricoSync(db, instance.id, {
    status: "running",
    progress: chunk.progress,
    erro: null,
    heartbeat: true,
  });

  const lidParaPn = mapaLidParaPn(chunk.phoneLidMappings);

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
      pendentes.push(() =>
        ingerirMensagem(db, {
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
          },
          status: msg.status ?? (direcao === "outbound" ? "sent" : "delivered"),
        }).then(() => undefined),
      );
    }
  }

  await pendentes.reduce<Promise<void>>((acc, run) => acc.then(run), Promise.resolve());

  const concluido = historySyncConcluido(chunk);
  if (concluido) {
    await atualizarProgressoHistoricoSync(db, instance.id, { marcarConcluido: true });
  }

  return { ignorado: false, concluido, progress: chunk.progress ?? 0 };
}
