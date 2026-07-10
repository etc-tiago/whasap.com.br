import { createFileRoute, Link, Navigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { Button } from "@whasap/ui/components/button";
import { Card, CardContent, CardHeader, CardTitle } from "@whasap/ui/components/card";
import { Badge } from "@whasap/ui/components/badge";
import { Plus } from "lucide-react";

import { rotuloWhatsApp } from "@whasap/config";
import {
  instanciaOperacional,
  instanciaPrecisaConexao,
  rotulosStatusInstancia,
} from "@/lib/instancia-status";
import { orgInput } from "@/lib/org-input";
import { orpc, orpcClient, type InstanciaItem } from "@/lib/orpc";
import { useOrganizacaoHash } from "@/lib/use-organizacao-hash";

export const Route = createFileRoute("/_panel/$organizacaoHash/")({
  component: HomePage,
});

function HomePage() {
  const organizacaoHash = useOrganizacaoHash();
  const queryClient = useQueryClient();

  const instances = useQuery(
    orpc.instancia.lista.queryOptions({
      input: orgInput(organizacaoHash),
    }),
  );

  const lista = instances.data ?? [];
  const operacionais = lista.filter((i: InstanciaItem) => instanciaOperacional(i.status));
  const desconectadas = lista.filter((i: InstanciaItem) => instanciaPrecisaConexao(i.status));

  useEffect(() => {
    if (!organizacaoHash || !instances.isSuccess || !instances.data) return;
    if (instances.data.some((i) => instanciaOperacional(i.status))) return;
    const pendentes = instances.data.filter((i) => instanciaPrecisaConexao(i.status));
    if (pendentes.length === 0) return;

    let cancelled = false;
    void (async () => {
      await Promise.allSettled(
        pendentes.map((i) => orpcClient.instancia.statusConexao({ instanciaId: i.id })),
      );
      if (!cancelled) {
        await queryClient.invalidateQueries({
          queryKey: orpc.instancia.lista.key({ input: { organizacaoHash } }),
        });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [organizacaoHash, instances.isSuccess, instances.data, queryClient]);

  if (!organizacaoHash) return null;

  if (operacionais.length > 0) {
    return <Navigate to="/$organizacaoHash/inbox" params={{ organizacaoHash }} />;
  }

  return (
    <div className="h-full space-y-6 overflow-auto p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Inbox</h1>
          <p className="text-sm text-muted-foreground">
            {operacionais.length > 0
              ? "Selecione um WhatsApp para abrir a caixa de entrada."
              : desconectadas.length > 0
                ? "Há WhatsApps desconectados aguardando reconexão."
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

      {lista.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>Nenhum WhatsApp cadastrado</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              O painel está pronto. Adicione seu primeiro WhatsApp Business ou Cloud para começar a
              receber mensagens.
            </p>
            <Button asChild>
              <Link
                to="/$organizacaoHash/integracao"
                params={{ organizacaoHash }}
                search={{ instance: "", step: "", modo: "novo" }}
              >
                Adicionar WhatsApp
              </Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {operacionais.length > 0 && (
            <section className="space-y-3">
              <h2 className="text-sm font-medium text-muted-foreground">Disponíveis</h2>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {operacionais.map((inst: InstanciaItem) => (
                  <Card key={inst.id}>
                    <CardHeader className="flex flex-row items-start justify-between space-y-0">
                      <CardTitle className="text-base">{inst.nome}</CardTitle>
                      <Badge>{rotulosStatusInstancia[inst.status]}</Badge>
                    </CardHeader>
                    <CardContent>
                      <p className="mb-3 text-xs text-muted-foreground">
                        {rotuloWhatsApp(inst.provider)}
                      </p>
                      <Button asChild size="sm">
                        <Link to="/$organizacaoHash/inbox" params={{ organizacaoHash }}>
                          Abrir conversas
                        </Link>
                      </Button>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </section>
          )}

          {desconectadas.length > 0 && (
            <section className="space-y-3">
              <h2 className="text-sm font-medium text-muted-foreground">Desconectados</h2>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {desconectadas.map((inst: InstanciaItem) => (
                  <Card key={inst.id}>
                    <CardHeader className="flex flex-row items-start justify-between space-y-0">
                      <CardTitle className="text-base">{inst.nome}</CardTitle>
                      <Badge variant="outline">
                        {rotulosStatusInstancia[inst.status] ?? inst.status}
                      </Badge>
                    </CardHeader>
                    <CardContent>
                      <p className="mb-3 text-xs text-muted-foreground">
                        {rotuloWhatsApp(inst.provider)}
                      </p>
                      <Button asChild size="sm" variant="outline">
                        <Link
                          to="/$organizacaoHash/integracao"
                          params={{ organizacaoHash }}
                          search={{ instance: inst.id, step: "", modo: "" }}
                        >
                          Reconectar
                        </Link>
                      </Button>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  );
}
