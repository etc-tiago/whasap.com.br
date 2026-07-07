import type { RequestLogger } from "evlog";
import { defineWorkerFetch, initWorkersLogger } from "evlog/workers";

import type { ServicoEvlog } from "./servicos";
import { SERVICOS } from "./servicos";

const inicializados = new Set<string>();

/** Inicializa evlog uma vez por worker (idempotente). */
export function garantirWorkersLogger(servico: ServicoEvlog): void {
  const nome = SERVICOS[servico];
  if (inicializados.has(nome)) return;
  initWorkersLogger({ env: { service: nome } });
  inicializados.add(nome);
}

type HandlerWorker<TEnv> = (
  request: Request,
  env: TEnv,
  ctx: ExecutionContext,
  log: RequestLogger,
) => Response | Promise<Response>;

/** Envolve handler `fetch` de Worker com wide event por request. */
export function envolverWorkerFetch<TEnv>(servico: ServicoEvlog, handler: HandlerWorker<TEnv>) {
  garantirWorkersLogger(servico);
  return defineWorkerFetch(handler);
}
