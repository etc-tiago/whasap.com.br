import {
  atualizarProgressoHistoricoSync,
  processarHistorySyncChunk,
} from "@whasap/api-core";
import {
  colunasInstanciaWebhook,
  colunasSomenteId,
  criarDb,
  instancia,
  instanciaEvo,
} from "@whasap/db";
import { garantirWorkersLogger } from "@whasap/evlog/workers";
import { and, eq, isNull } from "drizzle-orm";

import type { Env, HistorySyncQueueMessage } from "./env";

async function processarMensagem(env: Env, msg: HistorySyncQueueMessage): Promise<void> {
  const object = await env.R2.get(msg.r2Key);
  if (!object) {
    throw new Error(`Chunk R2 ausente: ${msg.r2Key}`);
  }

  const data = (await object.json()) as Record<string, unknown>;
  const { db, sql } = criarDb(env.HYPERDRIVE.connectionString);

  try {
    const row = await db.query.instancia.findFirst({
      where: and(eq(instancia.uuid, msg.instanciaUuid), isNull(instancia.excluidoEm)),
      columns: colunasInstanciaWebhook,
    });
    if (!row) {
      console.warn("[whasap-history-sync] instância não encontrada", msg.instanciaUuid);
      return;
    }

    await processarHistorySyncChunk(
      db,
      { id: row.id, organizacaoId: row.organizacaoId, uuid: row.uuid },
      data,
    );
  } finally {
    await sql.end({ timeout: 5 });
  }
}

async function marcarFalha(env: Env, instanciaUuid: string, erro: string): Promise<void> {
  const { db, sql } = criarDb(env.HYPERDRIVE.connectionString);
  try {
    const row = await db.query.instancia.findFirst({
      where: and(eq(instancia.uuid, instanciaUuid), isNull(instancia.excluidoEm)),
      columns: colunasSomenteId,
    });
    if (!row) return;
    const evo = await db.query.instanciaEvo.findFirst({
      where: eq(instanciaEvo.instanciaId, row.id),
      columns: colunasSomenteId,
    });
    if (!evo) return;
    await atualizarProgressoHistoricoSync(db, row.id, {
      status: "failed",
      erro: erro.slice(0, 500),
    });
  } finally {
    await sql.end({ timeout: 5 });
  }
}

export default {
  async queue(batch: MessageBatch<HistorySyncQueueMessage>, env: Env): Promise<void> {
    garantirWorkersLogger("historySync");

    for (const message of batch.messages) {
      try {
        await processarMensagem(env, message.body);
        message.ack();
      } catch (err) {
        const texto = err instanceof Error ? err.message : String(err);
        console.error("[whasap-history-sync] falha", {
          instanciaUuid: message.body.instanciaUuid,
          r2Key: message.body.r2Key,
          erro: texto,
          attempts: message.attempts,
        });
        if (message.attempts >= 5) {
          await marcarFalha(env, message.body.instanciaUuid, texto);
          message.ack();
        } else {
          message.retry();
        }
      }
    }
  },
};
