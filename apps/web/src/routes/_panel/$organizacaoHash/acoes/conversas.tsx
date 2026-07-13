import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";

import { WaAcaoCard, useAcoesResumo } from "@/components/inbox/wa-acao-card";
import { orgInput } from "@/lib/org-input";
import { orpc, orpcClient } from "@/lib/orpc";
import { useOrganizacaoHash } from "@/lib/use-organizacao-hash";

export const Route = createFileRoute("/_panel/$organizacaoHash/acoes/conversas")({
  component: AcoesConversasPage,
});

function AcoesConversasPage() {
  const organizacaoHash = useOrganizacaoHash();
  const org = useQuery(
    orpc.organizacao.obter.queryOptions({
      input: orgInput(organizacaoHash),
    }),
  );
  const resumo = useQuery(useAcoesResumo(organizacaoHash));
  const isAdmin = org.data?.meuPapel === "admin";
  const d = resumo.data;

  if (!organizacaoHash) return null;

  return (
    <div className="max-w-2xl space-y-6 p-6">
      <div>
        <h2 className="text-lg font-semibold text-wa-text">Conversas</h2>
        <p className="mt-1 text-sm text-wa-text-muted">
          Limpe o backlog após sincronizar o histórico do WhatsApp.
        </p>
      </div>

      {!isAdmin ? (
        <p className="text-sm text-wa-text-muted">
          Apenas administradores podem executar estas ações.
        </p>
      ) : (
        <div className="space-y-4">
          <WaAcaoCard
            organizacaoHash={organizacaoHash}
            titulo="Fechar todas em atendimento"
            descricao="Fecha todas as conversas abertas. Útil logo após sincronizar o histórico, quando muitos contatos aparecem em atendimento."
            contagem={d?.abertas ?? 0}
            rotuloBotao="Fechar todas"
            variante="destructive"
            confirmarTexto="FINALIZAR"
            executar={(input) => orpcClient.acoes.finalizarTodas(input)}
          />
          <WaAcaoCard
            organizacaoHash={organizacaoHash}
            titulo={`Fechar inativas (${d?.horasAutoFecharInatividade ?? "72"}h)`}
            descricao="Fecha conversas abertas sem mensagem recente, conforme o limiar de automação da organização."
            contagem={d?.inativas ?? 0}
            rotuloBotao="Fechar inativas"
            variante="destructive"
            executar={(input) => orpcClient.acoes.finalizarInativas(input)}
          />
          <WaAcaoCard
            organizacaoHash={organizacaoHash}
            titulo="Marcar todas como lidas"
            descricao="Zera os badges de não lidas das conversas em atendimento (inclui contagens herdadas do sync)."
            contagem={d?.comNaoLidas ?? 0}
            contagemLabel="com não lidas"
            rotuloBotao="Marcar como lidas"
            executar={(input) => orpcClient.acoes.marcarTodasLidas(input)}
          />
        </div>
      )}
    </div>
  );
}
