import type { QueryClient } from "@tanstack/react-query";
import { useQuery } from "@tanstack/react-query";

import { orpc, orpcClient } from "./orpc";
import { reabrirSessaoCliente } from "./sessao-cliente";

const sessionQueryOptions = orpc.autenticacao.eu.queryOptions({
  retry: false,
  // Sessão só muda via login/logout/invalidate — evita seed pós-401 refetchar.
  staleTime: Number.POSITIVE_INFINITY,
  refetchOnWindowFocus: false,
  refetchOnReconnect: false,
});

export type SessaoWeb = Awaited<ReturnType<typeof orpcClient.autenticacao.eu>>;

export function useSession() {
  return useQuery({
    ...sessionQueryOptions,
    throwOnError: false,
  });
}

/** Confirma sessão no servidor (cookie JWT) após login e atualiza cache. */
export async function sincronizarSessaoPosAuth(queryClient: QueryClient) {
  reabrirSessaoCliente();
  await queryClient.fetchQuery(sessionQueryOptions);
}
