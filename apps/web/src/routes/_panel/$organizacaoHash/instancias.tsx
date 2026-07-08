import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@whasap/ui/components/button";
import { Card, CardContent, CardHeader, CardTitle } from "@whasap/ui/components/card";
import { Badge } from "@whasap/ui/components/badge";

import { rotuloWhatsApp } from "@whasap/config";

import { orgInput } from "@/lib/org-input";
import { orpc, type InstanciaItem } from "@/lib/orpc";
import { useOrganizacaoHash } from "@/lib/use-organizacao-hash";

export const Route = createFileRoute("/_panel/$organizacaoHash/instancias")({
  component: InstancesPage,
});

const statusLabels: Record<string, string> = {
  pending_connection: "Configurando",
  pending_payment: "Aguardando pagamento",
  provisioning: "Provisionando",
  disconnected: "Desconectada",
  connected: "Conectada",
  deactivated: "Desativada",
};

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

  if (!organizacaoHash) return null;

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">WhatsApp</h1>
          <p className="text-sm text-muted-foreground">
            R$ 99/mês por WhatsApp conectado — inclui 1.000 conversas/mês (3 dias grátis)
          </p>
        </div>
        {isAdmin && (
          <Button
            onClick={() =>
              navigate({
                to: "/$organizacaoHash/integracao",
                params: { organizacaoHash },
                search: { instance: "", step: "" },
              })
            }
          >
            Conectar WhatsApp
          </Button>
        )}
      </div>

      <div className="grid gap-4">
        {(instances.data ?? []).map((inst: InstanciaItem) => (
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
                <Badge variant="outline">{statusLabels[inst.status] ?? inst.status}</Badge>
              </div>
            </CardHeader>
            <CardContent className="flex gap-2">
              {inst.status !== "connected" && (
                <Button asChild size="sm" variant="outline">
                  <Link
                    to="/$organizacaoHash/integracao"
                    params={{ organizacaoHash }}
                    search={{ instance: inst.id, step: "" }}
                  >
                    Configurar
                  </Link>
                </Button>
              )}
              {inst.status === "connected" && inst.asaasSubscriptionId && (
                <Button asChild size="sm">
                  <Link
                    to="/$organizacaoHash/inbox/$instanceId"
                    params={{ organizacaoHash, instanceId: inst.id }}
                  >
                    Inbox
                  </Link>
                </Button>
              )}
            </CardContent>
          </Card>
        ))}
        {instances.data?.length === 0 && (
          <p className="text-sm text-muted-foreground">
            Nenhum WhatsApp conectado ainda.{" "}
            <Link
              to="/$organizacaoHash/integracao"
              params={{ organizacaoHash }}
              search={{ instance: "", step: "" }}
              className="text-wa-green underline"
            >
              Conecte o primeiro
            </Link>
            .
          </p>
        )}
      </div>
    </div>
  );
}
