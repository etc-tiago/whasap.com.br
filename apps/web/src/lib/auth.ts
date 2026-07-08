import type { QueryClient } from "@tanstack/react-query";
import { useQuery } from "@tanstack/react-query";

import { orpc, orpcClient } from "./orpc";

const sessionQueryOptions = orpc.autenticacao.eu.queryOptions({ retry: false });

export type SessaoWeb = Awaited<ReturnType<typeof orpcClient.autenticacao.eu>>;

export function useSession() {
  return useQuery({
    ...sessionQueryOptions,
    throwOnError: false,
  });
}

/** Confirma sessão no servidor (cookie JWT) após login e atualiza cache. */
export async function sincronizarSessaoPosAuth(queryClient: QueryClient) {
  await queryClient.fetchQuery(orpc.autenticacao.eu.queryOptions());
}
