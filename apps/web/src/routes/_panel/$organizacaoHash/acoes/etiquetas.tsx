import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@whasap/ui/components/select";

import { WaAcaoCard, useAcoesResumo } from "@/components/inbox/wa-acao-card";
import { orgInput } from "@/lib/org-input";
import { orpc, orpcClient } from "@/lib/orpc";
import { useOrganizacaoHash } from "@/lib/use-organizacao-hash";

export const Route = createFileRoute("/_panel/$organizacaoHash/acoes/etiquetas")({
  component: AcoesEtiquetasPage,
});

function AcoesEtiquetasPage() {
  const organizacaoHash = useOrganizacaoHash();
  const [etiquetaId, setEtiquetaId] = useState<string>("");

  const org = useQuery(
    orpc.organizacao.obter.queryOptions({
      input: orgInput(organizacaoHash),
    }),
  );
  const resumo = useQuery(useAcoesResumo(organizacaoHash));
  const etiquetas = useQuery(
    orpc.caixaEntrada.etiquetas.lista.queryOptions({
      input: orgInput(organizacaoHash),
    }),
  );

  const isAdmin = org.data?.meuPapel === "admin";
  const d = resumo.data;

  if (!organizacaoHash) return null;

  return (
    <div className="max-w-2xl space-y-6 p-6">
      <div>
        <h2 className="text-lg font-semibold text-wa-text">Etiquetas</h2>
        <p className="mt-1 text-sm text-wa-text-muted">
          Marque em massa os contatos das conversas em atendimento (ex.: pós-sync).
        </p>
      </div>

      {!isAdmin ? (
        <p className="text-sm text-wa-text-muted">
          Apenas administradores podem executar esta ação.
        </p>
      ) : (
        <WaAcaoCard
          organizacaoHash={organizacaoHash}
          titulo="Aplicar etiqueta às abertas"
          descricao="Atribui a etiqueta escolhida a todos os contatos com conversa em atendimento que ainda não a possuem."
          contagem={d?.abertas ?? 0}
          contagemLabel="contatos em atendimento"
          rotuloBotao="Aplicar etiqueta"
          disabled={!etiquetaId}
          executar={async (input) =>
            orpcClient.acoes.aplicarEtiquetaAbertas({
              ...input,
              etiquetaId,
            })
          }
          extras={
            <Select value={etiquetaId || undefined} onValueChange={setEtiquetaId}>
              <SelectTrigger className="w-full max-w-sm">
                <SelectValue placeholder="Escolha uma etiqueta" />
              </SelectTrigger>
              <SelectContent>
                {(etiquetas.data ?? []).map((e) => (
                  <SelectItem key={e.id} value={e.id}>
                    {e.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          }
        />
      )}
    </div>
  );
}
