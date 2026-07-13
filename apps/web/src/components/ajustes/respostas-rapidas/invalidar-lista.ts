import type { QueryClient } from "@tanstack/react-query";

import { orpc } from "@/lib/orpc";

/** Invalida a listagem de respostas rápidas da organização. */
export function invalidarListaRespostasRapidas(queryClient: QueryClient, organizacaoHash: string) {
  void queryClient.invalidateQueries({
    queryKey: orpc.caixaEntrada.respostasRapidas.lista.key({
      input: { organizacaoHash },
    }),
  });
}
