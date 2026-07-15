import { skipToken, useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Badge } from "@whasap/ui/components/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@whasap/ui/components/card";

import { orgInput } from "@/lib/org-input";
import { orpc } from "@/lib/orpc";
import { useOrganizacaoHash } from "@/lib/use-organizacao-hash";

export const Route = createFileRoute("/_panel/$organizacaoHash/campanha/historico")({
  component: CampanhaHistoricoPage,
});

function CampanhaHistoricoPage() {
  const organizacaoHash = useOrganizacaoHash();

  const resumo = useQuery(
    orpc.campanha.resumo.queryOptions({
      input: orgInput(organizacaoHash),
    }),
  );

  const lista = useQuery(
    orpc.campanha.listaEnvios.queryOptions({
      input: organizacaoHash ? { organizacaoHash, pagina: 1, porPagina: 50 } : skipToken,
    }),
  );

  if (!organizacaoHash) return null;

  const r = resumo.data;

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-6">
      <div>
        <h2 className="text-lg font-semibold text-wa-text">Histórico e relatório</h2>
        <p className="mt-1 text-sm text-wa-text-muted">Envios recentes do módulo de campanha.</p>
      </div>

      <div className="grid gap-3 sm:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Hoje</CardDescription>
            <CardTitle className="text-2xl">{r?.totalHoje ?? "—"}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Enviados hoje</CardDescription>
            <CardTitle className="text-2xl">{r?.enviadosHoje ?? "—"}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Erros hoje</CardDescription>
            <CardTitle className="text-2xl">{r?.errosHoje ?? "—"}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Última hora</CardDescription>
            <CardTitle className="text-2xl">{r?.enviadosHora ?? "—"}</CardTitle>
          </CardHeader>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Últimos envios</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {lista.isLoading ? (
            <p className="text-sm text-muted-foreground">Carregando…</p>
          ) : (lista.data?.itens.length ?? 0) === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum envio registrado ainda.</p>
          ) : (
            <ul className="divide-y divide-border">
              {lista.data!.itens.map((item) => (
                <li key={item.id} className="flex items-start justify-between gap-3 py-3 text-sm">
                  <div className="min-w-0">
                    <p className="font-medium text-wa-text">
                      {item.nomeDestinatario || "—"}{" "}
                      <span className="font-normal text-muted-foreground">{item.telefone}</span>
                    </p>
                    <p className="mt-0.5 line-clamp-2 text-muted-foreground">
                      {item.corpo || item.templateNome || "—"}
                    </p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {new Date(item.criadoEm).toLocaleString("pt-BR")}
                    </p>
                  </div>
                  <Badge variant={item.status === "enviado" ? "default" : "destructive"}>
                    {item.status}
                  </Badge>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
