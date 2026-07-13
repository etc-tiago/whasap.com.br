/**
 * Workflow por chunk HistorySync — steps curtos (ingest/mídia em lotes).
 *
 * Dashboard tipico:
 *   planejar-chunk → marcar-running →
 *   ingerir-lote-0 → persistir-midia-0-0 → … → limpar-midia-0 →
 *   ingerir-lote-1 → … →
 *   marcar-concluido
 */
import { WorkflowEntrypoint, type WorkflowEvent, type WorkflowStep } from "cloudflare:workers";
import { NonRetryableError } from "cloudflare:workflows";
import {
  atualizarProgressoHistoricoSync,
  contarLotesMidia,
  HISTORY_SYNC_INGEST_LOTE_TAMANHO,
  HISTORY_SYNC_MIDIA_CONCORRENCIA,
  planejarHistorySyncChunk,
  processarHistorySyncChunkLote,
  type JobMidiaInbound,
  type PlanoHistorySyncChunk,
} from "@whasap/api-core";
import { colunasInstanciaEvo, colunasInstanciaWebhook, criarDb, instancia } from "@whasap/db";
import { and, eq, isNull } from "drizzle-orm";

import type { Env, HistorySyncQueueMessage } from "./env";
import {
  chaveR2MidiaJobsLote,
  marcarFalha,
  persistirMidiasLoteUnico,
} from "./helpers";

type InstanciaWorkflow = {
  id: number;
  organizacaoId: number;
  uuid: string;
  evoToken: string | null;
};

const RETRY_INGEST = {
  retries: { limit: 2, delay: "10 seconds" as const, backoff: "exponential" as const },
  timeout: "2 minutes" as const,
};

const RETRY_MIDIA = {
  retries: { limit: 2, delay: "15 seconds" as const, backoff: "exponential" as const },
  timeout: "2 minutes" as const,
};

export class HistorySyncChunkWorkflow extends WorkflowEntrypoint<Env, HistorySyncQueueMessage> {
  async run(event: WorkflowEvent<HistorySyncQueueMessage>, step: WorkflowStep) {
    const { instanciaUuid, r2Key, receivedAt } = event.payload;

    try {
      const meta = await step.do(
        "carregar-chunk-r2",
        { retries: { limit: 3, delay: "5 seconds", backoff: "exponential" } },
        async () => {
          const object = await this.env.R2.get(r2Key);
          if (!object) throw new Error(`Chunk R2 ausente: ${r2Key}`);
          return {
            size: object.size,
            receivedAt,
            contentType: object.httpMetadata?.contentType ?? null,
          };
        },
      );

      const instanciaCtx = await step.do(
        "resolver-instancia",
        { retries: { limit: 2, delay: "3 seconds" } },
        async (): Promise<InstanciaWorkflow | null> => {
          const { db, sql } = criarDb(this.env.HYPERDRIVE.connectionString);
          try {
            const row = await db.query.instancia.findFirst({
              where: and(eq(instancia.uuid, instanciaUuid), isNull(instancia.excluidoEm)),
              columns: colunasInstanciaWebhook,
              with: { evo: { columns: colunasInstanciaEvo } },
            });
            if (!row) return null;
            return {
              id: row.id,
              organizacaoId: row.organizacaoId,
              uuid: row.uuid,
              evoToken: row.evo?.token ?? null,
            };
          } finally {
            await sql.end({ timeout: 5 });
          }
        },
      );

      if (!instanciaCtx) {
        await step.do("ignorar-instancia-ausente", async () => ({
          instanciaUuid,
          r2Key,
          size: meta.size,
        }));
        return { status: "skipped" as const, motivo: "instancia_nao_encontrada" };
      }

      const plano = await step.do(
        "planejar-chunk",
        { retries: { limit: 2, delay: "5 seconds" } },
        async (): Promise<PlanoHistorySyncChunk> => {
          const object = await this.env.R2.get(r2Key);
          if (!object) throw new NonRetryableError(`Chunk R2 ausente: ${r2Key}`);
          const data = (await object.json()) as Record<string, unknown>;
          return planejarHistorySyncChunk(data);
        },
      );

      if (plano.ignorado) {
        if (plano.atualizarProgresso) {
          await step.do("atualizar-progresso-ignorado", async () => {
            const { db, sql } = criarDb(this.env.HYPERDRIVE.connectionString);
            try {
              await atualizarProgressoHistoricoSync(db, instanciaCtx.id, {
                status: "running",
                progress: plano.progress,
              });
              return { progress: plano.progress };
            } finally {
              await sql.end({ timeout: 5 });
            }
          });
        }
        return {
          status: "ignored" as const,
          progress: plano.progress,
          syncType: plano.syncType,
        };
      }

      if (plano.atualizarProgresso) {
        await step.do("marcar-running", async () => {
          const { db, sql } = criarDb(this.env.HYPERDRIVE.connectionString);
          try {
            await atualizarProgressoHistoricoSync(db, instanciaCtx.id, {
              status: "running",
              progress: plano.progress,
              erro: null,
              heartbeat: true,
            });
            return { progress: plano.progress };
          } finally {
            await sql.end({ timeout: 5 });
          }
        });
      }

      let offset = 0;
      let loteIdx = 0;
      let midiaJobsCount = 0;
      let midiasOk = 0;
      let midiasFalhas = 0;

      while (offset < plano.totalMensagens) {
        const ingest = await step.do(
          `ingerir-lote-${loteIdx}`,
          RETRY_INGEST,
          async () => {
            const object = await this.env.R2.get(r2Key);
            if (!object) throw new NonRetryableError(`Chunk R2 ausente: ${r2Key}`);
            const data = (await object.json()) as Record<string, unknown>;
            const { db, sql } = criarDb(this.env.HYPERDRIVE.connectionString);
            try {
              const lote = await processarHistorySyncChunkLote(db, instanciaCtx, data, {
                offset,
                limit: HISTORY_SYNC_INGEST_LOTE_TAMANHO,
              });

              let midiaJobsKey: string | null = null;
              const midiaLotes = contarLotesMidia(lote.midiaJobs.length);
              if (lote.midiaJobs.length > 0) {
                midiaJobsKey = chaveR2MidiaJobsLote(r2Key, loteIdx);
                await this.env.R2.put(midiaJobsKey, JSON.stringify(lote.midiaJobs), {
                  httpMetadata: { contentType: "application/json" },
                });
              }

              return {
                processadas: lote.processadas,
                offsetProximo: lote.offsetProximo,
                esgotado: lote.esgotado,
                midiaJobsCount: lote.midiaJobs.length,
                midiaJobsKey,
                midiaLotes,
              };
            } finally {
              await sql.end({ timeout: 5 });
            }
          },
        );

        midiaJobsCount += ingest.midiaJobsCount;

        if (ingest.midiaJobsKey && ingest.midiaLotes > 0) {
          for (let j = 0; j < ingest.midiaLotes; j++) {
            const resumo = await step.do(
              `persistir-midia-${loteIdx}-${j}`,
              RETRY_MIDIA,
              async () => {
                const object = await this.env.R2.get(ingest.midiaJobsKey!);
                if (!object) return { ok: 0, falhas: 0 };
                const jobs = (await object.json()) as JobMidiaInbound[];
                const inicio = j * HISTORY_SYNC_MIDIA_CONCORRENCIA;
                const fatia = jobs.slice(inicio, inicio + HISTORY_SYNC_MIDIA_CONCORRENCIA);
                if (fatia.length === 0) return { ok: 0, falhas: 0 };
                const { db, sql } = criarDb(this.env.HYPERDRIVE.connectionString);
                try {
                  return await persistirMidiasLoteUnico(this.env, db, fatia);
                } finally {
                  await sql.end({ timeout: 5 });
                }
              },
            );
            midiasOk += resumo.ok;
            midiasFalhas += resumo.falhas;
          }

          await step.do(`limpar-midia-${loteIdx}`, async () => {
            await this.env.R2.delete(ingest.midiaJobsKey!);
            return { deleted: ingest.midiaJobsKey };
          });
        }

        offset = ingest.offsetProximo;
        loteIdx += 1;
        if (ingest.esgotado) break;
      }

      if (plano.marcarConcluidoAoFinal) {
        await step.do("marcar-concluido", async () => {
          const { db, sql } = criarDb(this.env.HYPERDRIVE.connectionString);
          try {
            await atualizarProgressoHistoricoSync(db, instanciaCtx.id, {
              marcarConcluido: true,
            });
            return { concluido: true };
          } finally {
            await sql.end({ timeout: 5 });
          }
        });
      }

      return {
        status: "ok" as const,
        progress: plano.progress,
        concluido: plano.marcarConcluidoAoFinal,
        totalMensagens: plano.totalMensagens,
        lotesIngestao: loteIdx,
        midiaJobsCount,
        midias: { ok: midiasOk, falhas: midiasFalhas },
      };
    } catch (err) {
      const texto = err instanceof Error ? err.message : String(err);
      await step.do("marcar-falha", async () => {
        await marcarFalha(this.env, instanciaUuid, texto);
        return { instanciaUuid, erro: texto.slice(0, 500) };
      });
      throw err;
    }
  }
}
