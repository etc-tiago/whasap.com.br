import { useQuery } from "@tanstack/react-query";

import { orpc } from "./orpc";

const sessionQueryOptions = orpc.autenticacao.eu.queryOptions({ retry: false });

export function useSession() {
  return useQuery({
    ...sessionQueryOptions,
    throwOnError: false,
  });
}
