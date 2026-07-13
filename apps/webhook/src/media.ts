import type { WorkerExecutionContext } from "@whasap/evlog/workers";
import { persistirMidiaInbound, type JobMidiaInbound } from "@whasap/api-core";
import { log } from "@whasap/evlog";
import type { Db } from "@whasap/db";

import type { Env } from "./env";

export type InboundMediaJob = JobMidiaInbound;

export function scheduleInboundMedia(
  ctx: WorkerExecutionContext,
  env: Env,
  db: Db,
  job: InboundMediaJob | null,
): void {
  if (!job) return;
  ctx.waitUntil(
    persistirMidiaInbound(env, db, job).catch((err) => {
      log.error({
        contexto: "webhook.media",
        erro: err instanceof Error ? err.message : String(err),
        messageId: job.messageId,
        provider: job.provider,
      });
    }),
  );
}

export async function storeInboundMedia(env: Env, db: Db, job: InboundMediaJob): Promise<void> {
  await persistirMidiaInbound(env, db, job);
}
