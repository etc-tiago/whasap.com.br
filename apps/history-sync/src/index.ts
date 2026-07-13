/**
 * Consumer da fila HistorySync: dispara Workflow por chunk (passos no dashboard).
 * Cron: conclui syncs ociosos sem chunk há 5 min.
 */
import { concluirHistoricosSyncOciosos, deveMarcarFalhaAposTentativasFila } from "@whasap/api-core";
import { criarDb } from "@whasap/db";
import { garantirWorkersLogger } from "@whasap/evlog/workers";

import type { Env, HistorySyncQueueMessage } from "./env";
import { idWorkflowHistorySyncChunk, marcarFalha } from "./helpers";

export { HistorySyncChunkWorkflow } from "./workflow-chunk";

async function varrerOciosos(env: Env): Promise<void> {
  garantirWorkersLogger("historySync");
  const { db, sql } = criarDb(env.HYPERDRIVE.connectionString);
  try {
    const n = await concluirHistoricosSyncOciosos(db);
    if (n > 0) {
      console.info("[whasap-history-sync] syncs concluídos por idle", { count: n });
    }
  } finally {
    await sql.end({ timeout: 5 });
  }
}

export default {
  async queue(batch: MessageBatch<HistorySyncQueueMessage>, env: Env): Promise<void> {
    garantirWorkersLogger("historySync");

    await batch.messages.reduce<Promise<void>>(async (prev, message) => {
      await prev;
      const body = message.body;
      try {
        await env.HISTORY_SYNC_CHUNK_WORKFLOW.create({
          id: idWorkflowHistorySyncChunk(body.r2Key),
          params: body,
        });
        message.ack();
      } catch (err) {
        const texto = err instanceof Error ? err.message : String(err);
        // Redelivery após create bem-sucedido: ID já existe → trata como ok.
        if (/already exists|already been used/i.test(texto)) {
          message.ack();
          return;
        }
        console.error("[whasap-history-sync] falha ao criar workflow", {
          instanciaUuid: body.instanciaUuid,
          r2Key: body.r2Key,
          erro: texto,
          attempts: message.attempts,
        });
        if (deveMarcarFalhaAposTentativasFila(message.attempts)) {
          await marcarFalha(env, body.instanciaUuid, `Falha ao iniciar workflow: ${texto}`);
          message.ack();
        } else {
          message.retry();
        }
      }
    }, Promise.resolve());
  },

  async scheduled(
    _controller: ScheduledController,
    env: Env,
    ctx: ExecutionContext,
  ): Promise<void> {
    ctx.waitUntil(varrerOciosos(env));
  },
};
