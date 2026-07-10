import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@whasap/ui/components/button";
import { Card, CardContent, CardHeader, CardTitle } from "@whasap/ui/components/card";
import { Badge } from "@whasap/ui/components/badge";

import { rotuloWhatsApp } from "@whasap/config";

import {
  instanciaOperacional,
  instanciaPrecisaConexao,
  instanciasParaReconectar,
  rotulosStatusInstancia,
} from "@/lib/instancia-status";
import { orgInput } from "@/lib/org-input";
import { orpc, type InstanciaItem } from "@/lib/orpc";
import { useOrganizacaoHash } from "@/lib/use-organizacao-hash";

export const Route = createFileRoute("/_panel/$organizacaoHash/instancias")({
  component: InstancesPage,
});

function InstancesPage() {
  const navigate = useNavigate();
  const organizacaoHash = useOrganizacaoHash();

  const org = useQuery(
    orpc.organizacao.obter.queryOptions({
      input: orgInput(organizacaoHash),
    }),
  );

  const instances = useQuery(
    orpc.instancia.lista.queryOptions({
      input: orgInput(organizacaoHash),
    }),
  );

  const isAdmin = org.data?.meuPapel === "admin";
  const lista = instances.data ?? [];
  const paraReconectar = instanciasParaReconectar(lista);
  const conectadas = lista.filter((i) => instanciaOperacional(i.status));

  if (!organizacaoHash) return null;

  return (
    <div className="h-full space-y-6 overflow-auto p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">WhatsApp</h1>
          <p className="text-sm text-muted-foreground">
            {lista.length} no total — {conectadas.length} conectada
            {conectadas.length === 1 ? "" : "s"}
            {paraReconectar.length > 0 && `, ${paraReconectar.length} aguardando conexão`}
          </p>
        </div>
        {isAdmin && (
          <div className="flex flex-wrap gap-2">
            {paraReconectar.length > 0 && (
              <Button
                onClick={() =>
                  navigate({
                    to: "/$organizacaoHash/integracao",
                    params: { organizacaoHash },
                    search: { instance: "", step: "", modo: "" },
                  })
                }
              >
                Reconectar WhatsApp
              </Button>
            )}
            <Button
              variant={paraReconectar.length > 0 ? "outline" : "default"}
              onClick={() =>
                navigate({
                  to: "/$organizacaoHash/integracao",
                  params: { organizacaoHash },
                  search: { instance: "", step: "", modo: "novo" },
                })
              }
            >
              Adicionar WhatsApp
            </Button>
          </div>
        )}
      </div>

      <div className="grid gap-4">
        {lista.map((inst: InstanciaItem) => (
          <Card key={inst.id}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0">
              <div>
                <CardTitle className="text-base">{inst.nome}</CardTitle>
                <p className="text-xs text-muted-foreground">{rotuloWhatsApp(inst.provider)}</p>
              </div>
              <div className="flex gap-2">
                {inst.trialEndsAt && new Date(inst.trialEndsAt) > new Date() && (
                  <Badge variant="secondary">Trial</Badge>
                )}
                <Badge variant={instanciaOperacional(inst.status) ? "default" : "outline"}>
                  {rotulosStatusInstancia[inst.status] ?? inst.status}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="flex gap-2">
              {instanciaPrecisaConexao(inst.status) && (
                <Button asChild size="sm" variant="outline">
                  <Link
                    to="/$organizacaoHash/integracao"
                    params={{ organizacaoHash }}
                    search={{ instance: inst.id, step: "", modo: "" }}
                  >
                    Reconectar
                  </Link>
                </Button>
              )}
              {instanciaOperacional(inst.status) && (
                <Button asChild size="sm" variant={inst.asaasSubscriptionId ? "default" : "outline"}>
                  <Link
                    to="/$organizacaoHash/inbox/$instanceId"
                    params={{ organizacaoHash, instanceId: inst.id }}
                  >
                    Abrir conversas
                  </Link>
                </Button>
              )}
            </CardContent>
          </Card>
        ))}
        {lista.length === 0 && (
          <p className="text-sm text-muted-foreground">
            Nenhum WhatsApp cadastrado ainda.{" "}
            <Link
              to="/$organizacaoHash/integracao"
              params={{ organizacaoHash }}
              search={{ instance: "", step: "", modo: "novo" }}
              className="text-wa-green underline"
            >
              Adicione o primeiro
            </Link>
            .
          </p>
        )}
      </div>
    </div>
  );
}
