/**
 * Worker de webhooks: Evolution (`/evo`), Meta Cloud (`/cloud`) e Asaas (`/asaas`).
 *
 * - Evolution/Meta: persiste em `webhookEvento`, processa, marca `processadoEm`, loga payload no R2.
 * - Asaas: persiste em `asaasWebhookRegistro` (idempotente por `asaasIdEvento`), sem R2 nem `processadoEm`.
 *   Checkout é criado no api-web; ativação de instância/pacote ocorre aqui via `handleAsaasWebhook`.
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
