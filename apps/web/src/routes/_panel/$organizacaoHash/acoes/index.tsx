import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@whasap/ui/components/card";

import { useAcoesResumo } from "@/components/inbox/wa-acao-card";
import { orgInput } from "@/lib/org-input";
import { orpc } from "@/lib/orpc";
import { useOrganizacaoHash } from "@/lib/use-organizacao-hash";

export const Route = createFileRoute("/_panel/$organizacaoHash/acoes/")({
  component: AcoesIndexPage,
});

function AcoesIndexPage() {
  const organizacaoHash = useOrganizacaoHash();

  const resumo = useQuery(useAcoesResumo(organizacaoHash));
  const org = useQuery(
    orpc.organizacao.obter.queryOptions({
      input: orgInput(organizacaoHash),
    }),
  );

  const d = resumo.data;

  return (
    <div className="max-w-2xl space-y-6 p-6">
      <div>
        <h2 className="text-lg font-semibold text-wa-text">Visão geral</h2>
        <p className="mt-1 text-sm text-wa-text-muted">
          Contagens das conversas em atendimento. Use o menu ao lado para limpar o backlog após
          sincronizar o WhatsApp ou redistribuir a equipe.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <Metrica titulo="Em atendimento" valor={d?.abertas} />
        <Metrica titulo="Sem atendente" valor={d?.semDono} />
        <Metrica titulo="Com não lidas" valor={d?.comNaoLidas} />
        <Metrica
          titulo={`Inativas (${d?.horasAutoFecharInatividade ?? org.data?.horasAutoFecharInatividade ?? "72"}h)`}
          valor={d?.inativas}
        />
        <Metrica titulo="Atribuídas a mim" valor={d?.minhasAtribuidas} />
      </div>
    </div>
  );
}

function Metrica({ titulo, valor }: { titulo: string; valor: number | undefined }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-wa-text-muted">{titulo}</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-2xl font-semibold tabular-nums text-wa-text">
          {valor === undefined ? "—" : valor}
        </p>
      </CardContent>
    </Card>
  );
}
