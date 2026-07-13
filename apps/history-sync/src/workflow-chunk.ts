/**
 * Workflow por chunk HistorySync — passos visíveis no dashboard Cloudflare.
 * Gatilho: fila `whasap-history-sync` cria uma instância por mensagem.
 */
import { WorkflowEntrypoint, type WorkflowEvent, type WorkflowStep } from "cloudflare:workers";
import { NonRetryableError } from "cloudflare:workflows";
import { processarHistorySyncChunk, type JobMidiaInbound } from "@whasap/api-core";
import { colunasInstanciaEvo, colunasInstanciaWebhook, criarDb, instancia } from "@whasap/db";
import { and, eq, isNull } from "drizzle-orm";

import type { Env, HistorySyncQueueMessage } from "./env";
import { chaveR2MidiaJobs, marcarFalha, persistirMidiasEmLotes } from "./helpers";

type InstanciaWorkflow = {
  id: number;
  organizacaoId: number;
  uuid: string;
  evoToken: string | null;
};

type ResultadoIngestao = {
  ignorado: boolean;
  concluido: boolean;
  progress: number;
  midiaJobsCount: number;
  midiaJobsKey: string | null;
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
          if (!object) {
            throw new Error(`Chunk R2 ausente: ${r2Key}`);
          }
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

      const ingest = await step.do(
        "ingerir-mensagens",
        { retries: { limit: 2, delay: "10 seconds", backoff: "exponential" } },
        async (): Promise<ResultadoIngestao> => {
          const object = await this.env.R2.get(r2Key);
          if (!object) {
            throw new NonRetryableError(`Chunk R2 ausente: ${r2Key}`);
          }
          const data = (await object.json()) as Record<string, unknown>;
          const { db, sql } = criarDb(this.env.HYPERDRIVE.connectionString);
          try {
            const result = await processarHistorySyncChunk(db, instanciaCtx, data);
            let midiaJobsKey: string | null = null;
            if (result.midiaJobs.length > 0) {
              midiaJobsKey = chaveR2MidiaJobs(r2Key);
              await this.env.R2.put(midiaJobsKey, JSON.stringify(result.midiaJobs), {
                httpMetadata: { contentType: "application/json" },
              });
            }
            return {
              ignorado: result.ignorado,
              concluido: result.concluido,
              progress: result.progress,
              midiaJobsCount: result.midiaJobs.length,
              midiaJobsKey,
            };
          } finally {
            await sql.end({ timeout: 5 });
          }
        },
      );

      let midias: { ok: number; falhas: number } | null = null;
      if (ingest.midiaJobsKey) {
        midias = await step.do(
          "persistir-midias",
          { retries: { limit: 2, delay: "15 seconds", backoff: "exponential" } },
          async () => {
            const object = await this.env.R2.get(ingest.midiaJobsKey!);
            if (!object) {
              return { ok: 0, falhas: 0 };
            }
            const jobs = (await object.json()) as JobMidiaInbound[];
            const { db, sql } = criarDb(this.env.HYPERDRIVE.connectionString);
            try {
              const resumo = await persistirMidiasEmLotes(this.env, db, jobs);
              await this.env.R2.delete(ingest.midiaJobsKey!);
              return resumo;
            } finally {
              await sql.end({ timeout: 5 });
            }
          },
        );
      }

      return {
        status: "ok" as const,
        progress: ingest.progress,
        concluido: ingest.concluido,
        ignorado: ingest.ignorado,
        midiaJobsCount: ingest.midiaJobsCount,
        midias,
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
