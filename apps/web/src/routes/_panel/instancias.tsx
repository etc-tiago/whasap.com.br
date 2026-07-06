import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { skipToken, useMutation, useQuery } from "@tanstack/react-query";
import { Button } from "@whasap/ui/components/button";
import { Card, CardContent, CardHeader, CardTitle } from "@whasap/ui/components/card";
import { Badge } from "@whasap/ui/components/badge";
import { useState } from "react";

import { useSession } from "@/lib/auth";
import { orpc, type InstanciaItem } from "@/lib/orpc";

export const Route = createFileRoute("/_panel/instancias")({
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
  const { data: session } = useSession();
  const orgId = session?.organizacao?.id;

  const instances = useQuery(
    orpc.instancia.lista.queryOptions({
      input: orgId ? { organizacaoId: orgId } : skipToken,
    }),
  );

  const isAdmin = session?.role === "admin";

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Instâncias</h1>
          <p className="text-sm text-muted-foreground">
            R$ 99/mês por instância — inclui 1.000 conversas/mês (3 dias grátis)
          </p>
        </div>
        {isAdmin && (
          <Button onClick={() => navigate({ to: "/onboarding", search: { instance: "", step: "" } })}>
            Nova instância
          </Button>
        )}
      </div>

      <div className="grid gap-4">
        {(instances.data ?? []).map((inst: InstanciaItem) => (
          <Card key={inst.id}>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base">{inst.nome}</CardTitle>
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
                  <Link to="/onboarding" search={{ instance: inst.id, step: "" }}>
                    Configurar
                  </Link>
                </Button>
              )}
              {inst.status === "connected" && inst.asaasSubscriptionId && (
                <Button asChild size="sm">
                  <Link to="/inbox/$instanceId" params={{ instanceId: inst.id }}>
                    Inbox
                  </Link>
                </Button>
              )}
            </CardContent>
          </Card>
        ))}
        {instances.data?.length === 0 && (
          <p className="text-sm text-muted-foreground">
            Nenhuma instância ainda.{" "}
            <Link to="/onboarding" search={{ instance: "", step: "" }} className="text-wa-green underline">
              Configure a primeira
            </Link>
            .
          </p>
        )}
      </div>
    </div>
  );
}
