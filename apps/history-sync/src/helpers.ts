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

/** Staging de jobs de mídia de um lote de ingestão (`ingerir-lote-N`). */
export function chaveR2MidiaJobsLote(r2KeyChunk: string, loteIngestao: number): string {
  return `${r2KeyChunk}.midia-lote-${loteIngestao}.json`;
}

export function truncarErroWorker(erro: string): string {
  return erro.slice(0, 500);
}

/** Persiste um único lote de mídia (já fatiado — um step do Workflow). */
export async function persistirMidiasLoteUnico(
  env: Env,
  db: ReturnType<typeof criarDb>["db"],
  jobs: JobMidiaInbound[],
): Promise<{ ok: number; falhas: number }> {
  const resultados = await Promise.allSettled(
    jobs.map((job) => persistirMidiaInbound(env, db, job)),
  );
  let ok = 0;
  let falhas = 0;
  for (let j = 0; j < resultados.length; j++) {
    const r = resultados[j]!;
    if (r.status === "rejected") {
      falhas += 1;
      console.error("[whasap-history-sync] falha mídia", {
        externalId: jobs[j]!.externalId,
        erro: r.reason instanceof Error ? r.reason.message : String(r.reason),
      });
    } else {
      ok += 1;
    }
  }
  return { ok, falhas };
}

/** @deprecated Preferir steps por lote via {@link persistirMidiasLoteUnico}. */
export async function persistirMidiasEmLotes(
  env: Env,
  db: ReturnType<typeof criarDb>["db"],
  jobs: JobMidiaInbound[],
): Promise<{ ok: number; falhas: number }> {
  const lotes = particionarEmLotes(jobs, HISTORY_SYNC_MIDIA_CONCORRENCIA);
  let ok = 0;
  let falhas = 0;
  for (const lote of lotes) {
    // oxlint-disable-next-line eslint/no-await-in-loop -- lotes sequenciais
    const r = await persistirMidiasLoteUnico(env, db, lote);
    ok += r.ok;
    falhas += r.falhas;
  }
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
