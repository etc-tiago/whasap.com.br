import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@whasap/ui/components/button";
import { Card, CardContent, CardHeader, CardTitle } from "@whasap/ui/components/card";
import { Plus } from "lucide-react";

import { rotuloWhatsApp } from "@whasap/config";
import { orpc, type InstanciaItem } from "@/lib/orpc";
import { orgInput } from "@/lib/org-input";
import { useOrganizacaoHash } from "@/lib/use-organizacao-hash";

export const Route = createFileRoute("/_panel/$organizacaoHash/")({
  component: HomePage,
});

function HomePage() {
  const organizacaoHash = useOrganizacaoHash();

  const instances = useQuery(
    orpc.instancia.lista.queryOptions({
      input: orgInput(organizacaoHash),
    }),
  );

  const connected = (instances.data ?? []).filter((i: InstanciaItem) => i.status === "connected");

  if (!organizacaoHash) return null;

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Inbox</h1>
          <p className="text-sm text-muted-foreground">
            {connected.length > 0
              ? "Selecione um WhatsApp conectado para ver conversas."
              : "Conecte seu WhatsApp Business ou Cloud para começar."}
          </p>
        </div>
        <Button asChild>
          <Link to="/$organizacaoHash/instancias" params={{ organizacaoHash }}>
            <Plus className="mr-2 h-4 w-4" />
            WhatsApp
          </Link>
        </Button>
      </div>

      {connected.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>Nenhum WhatsApp conectado</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              O painel está pronto. Conecte seu primeiro WhatsApp Business ou Cloud para começar a
              receber mensagens.
            </p>
            <Button asChild>
              <Link to="/$organizacaoHash/instancias" params={{ organizacaoHash }}>
                Conectar WhatsApp
              </Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {connected.map((inst: InstanciaItem) => (
            <Card key={inst.id}>
              <CardHeader>
                <CardTitle className="text-base">{inst.nome}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-xs text-muted-foreground mb-3">
                  {rotuloWhatsApp(inst.provider)}
                </p>
                <Button asChild size="sm" variant="outline">
                  <Link
                    to="/$organizacaoHash/inbox/$instanceId"
                    params={{ organizacaoHash, instanceId: inst.id }}
                  >
                    Abrir inbox
                  </Link>
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
