import type { WorkerExecutionContext } from "@whasap/evlog/workers";
import { persistirMidiaInbound, type JobMidiaInbound } from "@whasap/api-core";
import { criarDb } from "@whasap/db";
import { log } from "@whasap/evlog";

import type { Env } from "./env";

export type InboundMediaJob = JobMidiaInbound;

/**
 * Persiste mídia inbound em background com conexão DB própria.
 * Não reutilizar o `db` do request — ele é fechado no `finally` do webhook
 * antes deste waitUntil terminar (race que deixava `midiaR2Chave` null).
 */
export function scheduleInboundMedia(
  ctx: WorkerExecutionContext,
  env: Env,
  job: InboundMediaJob | null,
): void {
  if (!job) return;
  ctx.waitUntil(
    (async () => {
      const { db, sql } = criarDb(env.HYPERDRIVE.connectionString);
      try {
        await persistirMidiaInbound(env, db, job);
      } finally {
        await sql.end({ timeout: 5 });
      }
    })().catch((err) => {
      log.error({
        contexto: "webhook.media",
        erro: err instanceof Error ? err.message : String(err),
        messageId: job.messageId,
        provider: job.provider,
      });
    }),
  );
}

export async function storeInboundMedia(
  env: Env,
  db: Parameters<typeof persistirMidiaInbound>[1],
  job: InboundMediaJob,
): Promise<void> {
  await persistirMidiaInbound(env, db, job);
}
