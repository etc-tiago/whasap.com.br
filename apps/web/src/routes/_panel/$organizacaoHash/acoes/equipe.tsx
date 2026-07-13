import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";

import { WaAcaoCard, useAcoesResumo } from "@/components/inbox/wa-acao-card";
import { orgInput } from "@/lib/org-input";
import { orpc, orpcClient } from "@/lib/orpc";
import { useOrganizacaoHash } from "@/lib/use-organizacao-hash";

export const Route = createFileRoute("/_panel/$organizacaoHash/acoes/equipe")({
  component: AcoesEquipePage,
});

function AcoesEquipePage() {
  const organizacaoHash = useOrganizacaoHash();
  const org = useQuery(
    orpc.organizacao.obter.queryOptions({
      input: orgInput(organizacaoHash),
    }),
  );
  const resumo = useQuery(useAcoesResumo(organizacaoHash));
  const isAdmin = org.data?.meuPapel === "admin";
  const podeAtribuir = org.data?.meuPapel === "admin" || org.data?.meuPapel === "usuario";
  const d = resumo.data;

  if (!organizacaoHash) return null;

  return (
    <div className="max-w-2xl space-y-6 p-6">
      <div>
        <h2 className="text-lg font-semibold text-wa-text">Equipe</h2>
        <p className="mt-1 text-sm text-wa-text-muted">
          Redistribua conversas sem atendente e gerencie suas atribuições.
        </p>
      </div>

      <div className="space-y-4">
        {isAdmin ? (
          <WaAcaoCard
            organizacaoHash={organizacaoHash}
            titulo="Distribuir sem atendente"
            descricao="Atribui em rodízio as conversas abertas sem dono entre administradores e atendentes."
            contagem={d?.semDono ?? 0}
            contagemLabel="sem atendente"
            rotuloBotao="Distribuir"
            executar={(input) => orpcClient.acoes.distribuirSemDono(input)}
          />
        ) : null}

        {podeAtribuir ? (
          <>
            <WaAcaoCard
              organizacaoHash={organizacaoHash}
              titulo="Assumir sem atendente"
              descricao="Atribui a você todas as conversas em atendimento que ainda não têm dono."
              contagem={d?.semDono ?? 0}
              contagemLabel="sem atendente"
              rotuloBotao="Assumir"
              executar={(input) => orpcClient.acoes.assumirSemDono(input)}
            />
            <WaAcaoCard
              organizacaoHash={organizacaoHash}
              titulo="Liberar minhas atribuições"
              descricao="Remove você como atendente das conversas atribuídas a você (não fecha a conversa)."
              contagem={d?.minhasAtribuidas ?? 0}
              contagemLabel="atribuídas a mim"
              rotuloBotao="Liberar"
              executar={(input) => orpcClient.acoes.liberarMinhas(input)}
            />
          </>
        ) : (
          <p className="text-sm text-wa-text-muted">Sem permissão para atribuir conversas.</p>
        )}
      </div>
    </div>
  );
}
