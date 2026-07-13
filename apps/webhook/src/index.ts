/**
 * Worker de webhooks: Evolution (`/evo`) e Meta Cloud (`/cloud`).
 */
import { envolverWorkerFetch } from "@whasap/evlog/workers";

import { criarWebhookApp } from "./app";
import type { Env } from "./env";

export type { Env } from "./env";

export default envolverWorkerFetch<Env>("webhook", async (request, env, ctx, log) => {
  const url = new URL(request.url);
  log.set({ rota: url.pathname, metodo: request.method });

  const app = criarWebhookApp(log, ctx);
  return app.fetch(request, env, ctx as ExecutionContext);
});
