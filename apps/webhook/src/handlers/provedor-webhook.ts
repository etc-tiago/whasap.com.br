import type { RequestLogger } from "@whasap/evlog";
import type { WorkerExecutionContext } from "@whasap/evlog/workers";
import { eq } from "drizzle-orm";
import { comCriadoEm, criarDb, webhookEvento } from "@whasap/db";

import type { Env } from "../env";
import { processEvolutionWebhook, processMetaWebhook } from "../processors";
import { cloudLogKeyFromBody, evolutionLogKeyFromBody, putWebhookLog } from "../r2-log";

/**
 * Pipeline Evolution/Meta: log R2 → insert `webhookEvento` → processar → marcar `processadoEm`.
 * Erros no processor são logados; o evento permanece sem `processadoEm` para reprocessamento manual.
 */
export async function processarWebhookProvedor(
  ctx: WorkerExecutionContext,
  env: Env,
  source: "evo" | "cloud",
  body: string,
  log: RequestLogger,
): Promise<Response> {
  const { db, sql } = criarDb(env.HYPERDRIVE.connectionString);

  try {
    const r2Key = source === "evo" ? evolutionLogKeyFromBody(body) : cloudLogKeyFromBody(body);
    log.set({ webhook: { source, r2Key } });

    ctx.waitUntil(
      putWebhookLog(env, r2Key, body, { source, path: r2Key }).catch((err) => {
        log.error(err instanceof Error ? err : new Error(String(err)));
        log.set({ webhook: { r2Falhou: true, source } });
      }),
    );

    const [event] = await db
      .insert(webhookEvento)
      .values(
        comCriadoEm({
          origem: source,
          idEvento: r2Key,
          payload: body,
        }),
      )
      .returning({ id: webhookEvento.id });

    try {
      if (source === "cloud") {
        await processMetaWebhook(db, env, ctx, body);
      } else {
        await processEvolutionWebhook(db, env, ctx, body);
      }
      await db
        .update(webhookEvento)
        .set({ processadoEm: new Date() })
        .where(eq(webhookEvento.id, event!.id));
      log.set({ webhook: { processado: true, eventoId: event!.id } });
    } catch (err) {
      log.error(err instanceof Error ? err : new Error(String(err)));
      log.set({ webhook: { processadorFalhou: true, source } });
    }

    return Response.json({ received: true });
  } finally {
    await sql.end({ timeout: 5 });
  }
}
