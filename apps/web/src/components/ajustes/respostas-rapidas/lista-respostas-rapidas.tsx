import { useQuery } from "@tanstack/react-query";

import { orgInput } from "@/lib/org-input";
import { orpc } from "@/lib/orpc";
import { getOrpcErrorMessage } from "@/lib/orpc-error";

import { LinhaRespostaRapida } from "./linha-resposta-rapida";

type ListaRespostasRapidasProps = {
  organizacaoHash: string;
  enabled: boolean;
  onEditar: (id: string) => void;
};

/** Listagem — um único `useQuery`. */
export function ListaRespostasRapidas({
  organizacaoHash,
  enabled,
  onEditar,
}: ListaRespostasRapidasProps) {
  const lista = useQuery(
    orpc.caixaEntrada.respostasRapidas.lista.queryOptions({
      input: orgInput(organizacaoHash),
      enabled,
    }),
  );

  if (lista.isLoading) {
    return <p className="text-sm text-wa-text-muted">Carregando…</p>;
  }

  if (lista.isError) {
    return (
      <p className="text-sm text-destructive">
        {getOrpcErrorMessage(lista.error, "Não foi possível listar.")}
      </p>
    );
  }

  if ((lista.data?.length ?? 0) === 0) {
    return <p className="text-sm text-wa-text-muted">Nenhuma resposta rápida cadastrada.</p>;
  }

  return (
    <ul className="divide-y divide-wa-divider rounded-lg border border-wa-divider bg-wa-panel">
      {lista.data?.map((item) => (
        <LinhaRespostaRapida
          key={item.id}
          organizacaoHash={organizacaoHash}
          item={item}
          onEditar={onEditar}
        />
      ))}
    </ul>
  );
}
