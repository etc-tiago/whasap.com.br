import { createFileRoute } from "@tanstack/react-router";
import { skipToken, useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@whasap/ui/components/card";

import { orgInput } from "@/lib/org-input";
import { orpc, type RelatorioVisaoGeral } from "@/lib/orpc";
import { useOrganizacaoHash } from "@/lib/use-organizacao-hash";

export const Route = createFileRoute("/_panel/$organizacaoHash/relatorios")({
  component: ReportsPage,
});

function ReportsPage() {
  const organizacaoHash = useOrganizacaoHash();

  const org = useQuery(
    orpc.organizacao.obter.queryOptions({
      input: orgInput(organizacaoHash),
    }),
  );

  const ate = new Date();
  const de = new Date();
  de.setDate(de.getDate() - 30);

  const canViewReports = Boolean(organizacaoHash) && org.data?.meuPapel !== "usuario";

  const report = useQuery(
    orpc.relatorios.visaoGeral.queryOptions({
      input: canViewReports
        ? {
            organizacaoHash: organizacaoHash!,
            de: de.toISOString(),
            ate: ate.toISOString(),
          }
        : skipToken,
    }),
  );

  if (org.data?.meuPapel === "usuario") {
    return (
      <div className="p-6">
        <p className="text-sm text-muted-foreground">Relatórios não disponíveis para seu perfil.</p>
      </div>
    );
  }

  const data = report.data;

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-semibold">Relatórios</h1>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <MetricCard title="Conversas" value={data?.totalConversas ?? 0} />
        <MetricCard title="Abertas" value={data?.conversasAbertas ?? 0} />
        <MetricCard title="Mensagens enviadas" value={data?.mensagensEnviadas ?? 0} />
        <MetricCard title="Mensagens recebidas" value={data?.mensagensRecebidas ?? 0} />
      </div>
      {data?.porAgente && data.porAgente.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Por agente</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2 text-sm">
              {data.porAgente.map((a: RelatorioVisaoGeral["porAgente"][number]) => (
                <li key={a.usuarioId} className="flex justify-between">
                  <span>{a.nome}</span>
                  <span className="text-muted-foreground">
                    {a.conversasAtribuidas} conversas · {a.mensagensEnviadas} enviadas
                  </span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function MetricCard({ title, value }: { title: string; value: number }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-2xl font-semibold">{value}</p>
      </CardContent>
    </Card>
  );
}
