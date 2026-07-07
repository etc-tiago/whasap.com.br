/**
 * Worker de webhooks: Evolution (`/evo`), Meta Cloud (`/cloud`) e Asaas (`/asaas`).
 *
 * - Evolution/Meta: persiste em `webhookEvento`, processa, marca `processadoEm`, loga payload no R2.
 * - Asaas: persiste em `asaasWebhookRegistro` (idempotente por `asaasIdEvento`), sem R2 nem `processadoEm`.
 *   Checkout é criado no api-web; ativação de instância/pacote ocorre aqui via `handleAsaasWebhook`.
 */
import type { RequestLogger } from "@whasap/evlog";
import { envolverWorkerFetch } from "@whasap/evlog/workers";
import { eq } from "drizzle-orm";
import { asaasWebhookRegistro, comCriadoEm, criarDb, webhookEvento } from "@whasap/db";

import { handleAsaasWebhook } from "./asaas";
import type { Env } from "./env";
import { processEvolutionWebhook, processMetaWebhook } from "./processors";
import { cloudLogKeyFromBody, evolutionLogKeyFromBody, putWebhookLog } from "./r2-log";

export type { Env } from "./env";

async function timingSafeEqual(a: string, b: string): Promise<boolean> {
  const encoder = new TextEncoder();
  const aBytes = encoder.encode(a);
  const bBytes = encoder.encode(b);
  if (aBytes.byteLength !== bBytes.byteLength) return false;
  return crypto.subtle.timingSafeEqual(aBytes, bBytes);
}

/**
 * Pipeline Evolution/Meta: log R2 → insert `webhookEvento` → processar → marcar `processadoEm`.
 * Erros no processor são logados; o evento permanece sem `processadoEm` para reprocessamento manual.
 */
async function processarWebhookProvedor(
  ctx: ExecutionContext,
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

    return new Response(JSON.stringify({ received: true }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  } finally {
    await sql.end({ timeout: 5 });
  }
}

export default envolverWorkerFetch<Env>("webhook", async (request, env, ctx, log) => {
  const url = new URL(request.url);
  log.set({ rota: url.pathname, metodo: request.method });

  try {
    if (request.method === "GET" && url.pathname === "/cloud") {
      const mode = url.searchParams.get("hub.mode");
      const token = url.searchParams.get("hub.verify_token");
      const challenge = url.searchParams.get("hub.challenge");
      if (mode === "subscribe" && token === env.WHATSAPP_CLOUD_WEBHOOK_SECRET && challenge) {
        const response = new Response(challenge, { status: 200 });
        log.emit({ status: response.status });
        return response;
      }
      const response = new Response("Forbidden", { status: 403 });
      log.emit({ status: response.status });
      return response;
    }

    if (request.method !== "POST") {
      const response = new Response("Method not allowed", { status: 405 });
      log.emit({ status: response.status });
      return response;
    }

    const body = await request.text();

    if (url.pathname === "/asaas") {
      const { db, sql } = criarDb(env.HYPERDRIVE.connectionString);
      try {
        const token = request.headers.get("asaas-access-token") ?? "";
        const valid = await timingSafeEqual(token, env.ASAAS_WEBHOOK_TOKEN);
        if (!valid) {
          log.set({ webhook: { asaas: { assinaturaInvalida: true } } });
          const response = new Response("Invalid signature", { status: 401 });
          log.emit({ status: response.status });
          return response;
        }
        const event = JSON.parse(body) as { id: string; event: string };
        log.set({ webhook: { asaas: { id: event.id, tipo: event.event } } });
        try {
          await db.insert(asaasWebhookRegistro).values(
            comCriadoEm({
              asaasIdEvento: event.id,
              tipo: event.event,
              payload: body,
            }),
          );
        } catch {
          const response = new Response(JSON.stringify({ received: true }), {
            status: 200,
            headers: { "content-type": "application/json" },
          });
          log.set({ webhook: { asaas: { duplicado: true } } });
          log.emit({ status: response.status });
          return response;
        }
        await handleAsaasWebhook(db, body, env);
        const response = new Response(JSON.stringify({ received: true }), {
          status: 200,
          headers: { "content-type": "application/json" },
        });
        log.emit({ status: response.status });
        return response;
      } finally {
        await sql.end({ timeout: 5 });
      }
    }

    if (url.pathname === "/evo") {
      const response = await processarWebhookProvedor(ctx, env, "evo", body, log);
      log.emit({ status: response.status });
      return response;
    }

    if (url.pathname === "/cloud") {
      const response = await processarWebhookProvedor(ctx, env, "cloud", body, log);
      log.emit({ status: response.status });
      return response;
    }

    const response = new Response("Not found", { status: 404 });
    log.emit({ status: response.status });
    return response;
  } catch (err) {
    log.error(err instanceof Error ? err : new Error(String(err)));
    log.emit({ status: 500 });
    throw err;
  }
});
