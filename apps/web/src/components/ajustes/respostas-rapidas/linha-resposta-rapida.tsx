import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@whasap/ui/components/button";

import { orpc } from "@/lib/orpc";

import { invalidarListaRespostasRapidas } from "./invalidar-lista";

type ItemLista = {
  id: string;
  titulo: string;
  quantidadeItens: number;
  preview: string | null;
};

type LinhaRespostaRapidaProps = {
  organizacaoHash: string;
  item: ItemLista;
  onEditar: (id: string) => void;
};

/** Uma linha da lista — um único `useMutation` de exclusão. */
export function LinhaRespostaRapida({ organizacaoHash, item, onEditar }: LinhaRespostaRapidaProps) {
  const queryClient = useQueryClient();

  const excluir = useMutation(
    orpc.caixaEntrada.respostasRapidas.excluir.mutationOptions({
      onSuccess: () => invalidarListaRespostasRapidas(queryClient, organizacaoHash),
    }),
  );

  return (
    <li className="flex items-center gap-3 px-4 py-3">
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-wa-text">{item.titulo}</p>
        <p className="truncate text-xs text-wa-text-muted">
          {item.quantidadeItens} {item.quantidadeItens === 1 ? "mensagem" : "mensagens"}
          {item.preview ? ` · ${item.preview}` : ""}
        </p>
      </div>
      <Button variant="ghost" size="sm" onClick={() => onEditar(item.id)}>
        Editar
      </Button>
      <Button
        variant="ghost"
        size="sm"
        className="text-destructive"
        disabled={excluir.isPending}
        onClick={() => excluir.mutate({ organizacaoHash, id: item.id })}
      >
        Excluir
      </Button>
    </li>
  );
}
