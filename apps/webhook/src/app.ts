import type { RequestLogger } from "@whasap/evlog";
import type { WorkerExecutionContext } from "@whasap/evlog/workers";
import { Hono } from "hono";
import { asaasWebhookRegistro, comCriadoEm, criarDb } from "@whasap/db";

import { handleAsaasWebhook } from "./asaas";
import type { Env } from "./env";
import { processarWebhookProvedor } from "./handlers/provedor-webhook";
import { timingSafeEqual } from "./lib/timing-safe-equal";

export type WebhookHonoEnv = {
  Bindings: Env;
  Variables: {
    log: RequestLogger;
    workerCtx: WorkerExecutionContext;
  };
};

export function criarWebhookApp(log: RequestLogger, workerCtx: WorkerExecutionContext) {
  const app = new Hono<WebhookHonoEnv>();

  app.use("*", async (c, next) => {
    c.set("log", log);
    c.set("workerCtx", workerCtx);
    await next();
    log.emit({ status: c.res.status });
  });

  app.onError((err) => {
    log.error(err instanceof Error ? err : new Error(String(err)));
    log.emit({ status: 500 });
    throw err;
  });

  app.get("/cloud", (c) => {
    const mode = c.req.query("hub.mode");
    const token = c.req.query("hub.verify_token");
    const challenge = c.req.query("hub.challenge");
    if (mode === "subscribe" && token === c.env.WHATSAPP_CLOUD_WEBHOOK_SECRET && challenge) {
      return c.text(challenge);
    }
    return c.text("Forbidden", 403);
  });

  app.post("/asaas", async (c) => {
    const body = await c.req.text();
    const token = c.req.header("asaas-access-token") ?? "";
    const valid = await timingSafeEqual(token, c.env.ASAAS_WEBHOOK_TOKEN);
    if (!valid) {
      c.get("log").set({ webhook: { asaas: { assinaturaInvalida: true } } });
      return c.text("Invalid signature", 401);
    }

    const event = JSON.parse(body) as { id: string; event: string };
    c.get("log").set({ webhook: { asaas: { id: event.id, tipo: event.event } } });

    const { db, sql } = criarDb(c.env.HYPERDRIVE.connectionString);
    try {
      try {
        await db.insert(asaasWebhookRegistro).values(
          comCriadoEm({
            asaasIdEvento: event.id,
            tipo: event.event,
            payload: body,
          }),
        );
      } catch {
        c.get("log").set({ webhook: { asaas: { duplicado: true } } });
        return c.json({ received: true });
      }

      await handleAsaasWebhook(db, body, c.env);
      return c.json({ received: true });
    } finally {
      await sql.end({ timeout: 5 });
    }
  });

  app.post("/evo", async (c) => {
    const body = await c.req.text();
    return processarWebhookProvedor(c.get("workerCtx"), c.env, "evo", body, c.get("log"));
  });

  app.post("/cloud", async (c) => {
    const body = await c.req.text();
    return processarWebhookProvedor(c.get("workerCtx"), c.env, "cloud", body, c.get("log"));
  });

  app.notFound((c) => c.text("Not found", 404));

  return app;
}
