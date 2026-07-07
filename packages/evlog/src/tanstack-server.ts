import type { ServicoEvlog } from "./servicos";
import { envolverWorkerFetch } from "./workers";

type HandlerTanstack = {
  fetch: (request: Request, ...args: unknown[]) => Response | Promise<Response>;
};

/** Envolve o server entry do TanStack Start com wide event evlog por request. */
export function criarServerTanstackEvlog<TEnv>(
  servico: ServicoEvlog,
  handler: HandlerTanstack,
) {
  return envolverWorkerFetch<TEnv>(servico, async (request, _env, _ctx, log) => {
    const url = new URL(request.url);
    log.set({ rota: url.pathname, metodo: request.method });

    try {
      const response = await handler.fetch(request);
      log.emit({ status: response.status });
      return response;
    } catch (err) {
      log.error(err instanceof Error ? err : new Error(String(err)));
      log.emit({ status: 500 });
      throw err;
    }
  });
}
