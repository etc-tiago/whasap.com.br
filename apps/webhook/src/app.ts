import type { RequestLogger } from "@whasap/evlog";
import type { WorkerExecutionContext } from "@whasap/evlog/workers";
import { Hono } from "hono";

import type { Env } from "./env";
import { processarWebhookProvedor } from "./handlers/provedor-webhook";
import { verificarSubscribeCloud } from "./verificar-subscribe-cloud";

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

  app.get("/cloud", async (c) => {
    const mode = c.req.query("hub.mode");
    const token = c.req.query("hub.verify_token");
    const challenge = c.req.query("hub.challenge");
    if (mode === "subscribe" && challenge && (await verificarSubscribeCloud(c.env, token))) {
      return c.text(challenge);
    }
    return c.text("Forbidden", 403);
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
