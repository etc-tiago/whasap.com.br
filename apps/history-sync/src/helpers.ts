/**
 * Helpers do worker history-sync (fila → Workflow + mídias).
 */
import {
  atualizarProgressoHistoricoSync,
  HISTORY_SYNC_MIDIA_CONCORRENCIA,
  particionarEmLotes,
  persistirMidiaInbound,
  type JobMidiaInbound,
} from "@whasap/api-core";
import { colunasSomenteId, criarDb, instancia, instanciaEvo } from "@whasap/db";
import { and, eq, isNull } from "drizzle-orm";

import type { Env } from "./env";

/** ID estável do Workflow a partir da chave R2 do chunk (idempotente em redelivery). */
export function idWorkflowHistorySyncChunk(r2Key: string): string {
  const base =
    r2Key
      .split("/")
      .pop()
      ?.replace(/\.json$/i, "") ?? crypto.randomUUID();
  return `hs-${base}`.slice(0, 100);
}

/** Chave R2 temporária dos jobs de mídia gerados após ingestão. */
export function chaveR2MidiaJobs(r2KeyChunk: string): string {
  return `${r2KeyChunk}.midia-jobs.json`;
}

export function truncarErroWorker(erro: string): string {
  return erro.slice(0, 500);
}

export async function persistirMidiasEmLotes(
  env: Env,
  db: ReturnType<typeof criarDb>["db"],
  jobs: JobMidiaInbound[],
): Promise<{ ok: number; falhas: number }> {
  const lotes = particionarEmLotes(jobs, HISTORY_SYNC_MIDIA_CONCORRENCIA);
  let ok = 0;
  let falhas = 0;

  await lotes.reduce<Promise<void>>(async (prev, lote) => {
    await prev;
    const resultados = await Promise.allSettled(
      lote.map((job) => persistirMidiaInbound(env, db, job)),
    );
    for (let j = 0; j < resultados.length; j++) {
      const r = resultados[j]!;
      if (r.status === "rejected") {
        falhas += 1;
        console.error("[whasap-history-sync] falha mídia", {
          externalId: lote[j]!.externalId,
          erro: r.reason instanceof Error ? r.reason.message : String(r.reason),
        });
      } else {
        ok += 1;
      }
    }
  }, Promise.resolve());

  return { ok, falhas };
}

export async function marcarFalha(env: Env, instanciaUuid: string, erro: string): Promise<void> {
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
      erro: truncarErroWorker(erro),
    });
  } finally {
    await sql.end({ timeout: 5 });
  }
}
