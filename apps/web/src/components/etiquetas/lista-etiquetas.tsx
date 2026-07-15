import { useQuery } from "@tanstack/react-query";
import { Search } from "lucide-react";
import { useMemo, useState } from "react";

import { LinhaEtiqueta } from "@/components/etiquetas/linha-etiqueta";
import { orgInput } from "@/lib/org-input";
import { orpc } from "@/lib/orpc";

type ListaEtiquetasProps = {
  organizacaoHash: string;
  selecionadaId: string | null;
  onSelecionar: (id: string) => void;
};

export function ListaEtiquetas({
  organizacaoHash,
  selecionadaId,
  onSelecionar,
}: ListaEtiquetasProps) {
  const [busca, setBusca] = useState("");

  const lista = useQuery(
    orpc.caixaEntrada.etiquetas.lista.queryOptions({
      input: orgInput(organizacaoHash),
    }),
  );

  const filtradas = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    const itens = lista.data ?? [];
    if (!termo) return itens;
    return itens.filter((e) => e.nome.toLowerCase().includes(termo));
  }, [lista.data, busca]);

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2">
      <div className="flex items-center gap-2 rounded-full bg-wa-input px-3 py-2">
        <Search className="size-4 shrink-0 text-wa-icon" />
        <input
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          placeholder="Pesquisar etiquetas"
          className="min-w-0 flex-1 bg-transparent text-sm text-wa-text placeholder:text-wa-text-muted focus:outline-none"
        />
      </div>

      <div className="wa-scroll min-h-0 flex-1 overflow-y-auto">
        {lista.isPending ? (
          <p className="px-1 py-6 text-center text-sm text-wa-text-muted">Carregando…</p>
        ) : filtradas.length === 0 ? (
          <p className="px-1 py-6 text-center text-sm text-wa-text-muted">
            {busca.trim()
              ? "Nenhuma etiqueta encontrada."
              : "Nenhuma etiqueta ainda. Crie a primeira."}
          </p>
        ) : (
          <ul className="space-y-0.5">
            {filtradas.map((etiqueta) => (
              <li key={etiqueta.id}>
                <LinhaEtiqueta
                  id={etiqueta.id}
                  nome={etiqueta.nome}
                  cor={etiqueta.cor}
                  contatosContagem={etiqueta.contatosContagem}
                  selecionada={selecionadaId === etiqueta.id}
                  onSelecionar={onSelecionar}
                />
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
