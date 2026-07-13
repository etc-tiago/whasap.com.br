import {
  atualizarProgressoHistoricoSync,
  concluirHistoricosSyncOciosos,
  persistirMidiaInbound,
  processarHistorySyncChunk,
  type JobMidiaInbound,
} from "@whasap/api-core";
import {
  colunasInstanciaEvo,
  colunasInstanciaWebhook,
  colunasSomenteId,
  criarDb,
  instancia,
  instanciaEvo,
} from "@whasap/db";
import { garantirWorkersLogger } from "@whasap/evlog/workers";
import { and, eq, isNull } from "drizzle-orm";

import type { Env, HistorySyncQueueMessage } from "./env";

const CONCORRENCIA_MIDIA = 4;

async function persistirMidiasEmLotes(env: Env, db: ReturnType<typeof criarDb>["db"], jobs: JobMidiaInbound[]) {
  for (let i = 0; i < jobs.length; i += CONCORRENCIA_MIDIA) {
    const lote = jobs.slice(i, i + CONCORRENCIA_MIDIA);
    const resultados = await Promise.allSettled(
      lote.map((job) => persistirMidiaInbound(env, db, job)),
    );
    for (let j = 0; j < resultados.length; j++) {
      const r = resultados[j]!;
      if (r.status === "rejected") {
        console.error("[whasap-history-sync] falha mídia", {
          externalId: lote[j]!.externalId,
          erro: r.reason instanceof Error ? r.reason.message : String(r.reason),
        });
      }
    }
  }
}

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
      with: { evo: { columns: colunasInstanciaEvo } },
    });
    if (!row) {
      console.warn("[whasap-history-sync] instância não encontrada", msg.instanciaUuid);
      return;
    }

    const { midiaJobs } = await processarHistorySyncChunk(
      db,
      {
        id: row.id,
        organizacaoId: row.organizacaoId,
        uuid: row.uuid,
        evoToken: row.evo?.token ?? null,
      },
      data,
    );

    if (midiaJobs.length > 0) {
      await persistirMidiasEmLotes(env, db, midiaJobs);
    }
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
