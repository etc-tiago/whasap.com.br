import type { QueryClient } from "@tanstack/react-query";

import { orpc } from "@/lib/orpc";

/** Invalida queries de etiquetas da organização (lista, detalhe e contatos). */
export function invalidarEtiquetas(queryClient: QueryClient, organizacaoHash: string) {
  void queryClient.invalidateQueries({
    queryKey: orpc.caixaEntrada.etiquetas.lista.key({
      input: { organizacaoHash },
    }),
  });
  void queryClient.invalidateQueries({
    queryKey: orpc.caixaEntrada.etiquetas.key(),
  });
}
