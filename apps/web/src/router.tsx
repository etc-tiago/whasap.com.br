import { MutationCache, QueryCache, QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";

import { eSessaoNaoAutorizada } from "./lib/orpc-error";
import { QUERY_PERSIST_MAX_AGE_MS } from "./lib/query-persist";
import { limparEstadoClienteSessao } from "./lib/sessao-cliente";
import { routeTree } from "./routeTree.gen";

function PendingFallback() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background text-sm text-muted-foreground">
      Carregando…
    </div>
  );
}

export const getRouter = () => {
  const queryClient = new QueryClient({
    queryCache: new QueryCache({
      onError: (error) => {
        if (eSessaoNaoAutorizada(error)) {
          void limparEstadoClienteSessao(queryClient);
        }
      },
    }),
    mutationCache: new MutationCache({
      onError: (error) => {
        if (eSessaoNaoAutorizada(error)) {
          void limparEstadoClienteSessao(queryClient);
        }
      },
    }),
    defaultOptions: {
      queries: {
        // Precisa ser ≥ maxAge do persist; senão o GC descarta o cache rehidratado cedo demais.
        gcTime: QUERY_PERSIST_MAX_AGE_MS,
        // Inbox continua com staleTime efetivo 0 + poll; default curto evita confiar demais no persist.
        staleTime: 0,
      },
    },
  });

  const router = createRouter({
    routeTree,
    context: { queryClient },
    scrollRestoration: true,
    defaultPreloadStaleTime: 0,
    defaultPendingComponent: PendingFallback,
  });

  return router;
};
