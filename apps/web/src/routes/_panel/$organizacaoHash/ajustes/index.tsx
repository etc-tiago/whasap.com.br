import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Button } from "@whasap/ui/components/button";
import { Card, CardContent, CardHeader, CardTitle } from "@whasap/ui/components/card";

import { ConfigurarPagamentoDialog } from "@/components/configurar-pagamento-dialog";
import { orgInput } from "@/lib/org-input";
import { orpc } from "@/lib/orpc";
import { useOrganizacaoHash } from "@/lib/use-organizacao-hash";

export const Route = createFileRoute("/_panel/$organizacaoHash/ajustes/")({
  component: AjustesIndexPage,
});

function AjustesIndexPage() {
  const queryClient = useQueryClient();
  const organizacaoHash = useOrganizacaoHash();
  const [pagamentoInstancia, setPagamentoInstancia] = useState<{
    id: string;
    nome: string;
  } | null>(null);

  const org = useQuery(
    orpc.organizacao.obter.queryOptions({
      input: orgInput(organizacaoHash),
    }),
  );

  const instancias = useQuery(
    orpc.instancia.lista.queryOptions({
      input: orgInput(organizacaoHash),
      enabled: Boolean(organizacaoHash),
    }),
  );

  const assinaturas = useQuery(
    orpc.cobranca.assinaturas.queryOptions({
      input: orgInput(organizacaoHash),
      enabled: org.data?.meuPapel === "admin" && Boolean(organizacaoHash),
    }),
  );

  const instanciasSemAssinatura =
    instancias.data?.filter((i) => i.status === "connected" && !i.asaasSubscriptionId) ?? [];

  const cancelar = useMutation(
    orpc.cobranca.cancelarAssinatura.mutationOptions({
      onSuccess: () => {
        if (organizacaoHash) {
          queryClient.invalidateQueries({
            queryKey: orpc.cobranca.assinaturas.key({ input: { organizacaoHash } }),
          });
          queryClient.invalidateQueries({
            queryKey: orpc.instancia.lista.key({ input: { organizacaoHash } }),
          });
        }
      },
    }),
  );

  return (
    <div className="max-w-lg space-y-6 p-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Organização</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <p>
            <span className="text-muted-foreground">Nome:</span> {org.data?.nome}
          </p>
          <p>
            <span className="text-muted-foreground">Papel:</span> {org.data?.meuPapel}
          </p>
          {org.data?.documento && (
            <p>
              <span className="text-muted-foreground">CPF/CNPJ:</span> {org.data.documento}
            </p>
          )}
        </CardContent>
      </Card>
      {org.data?.meuPapel === "admin" && organizacaoHash && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Cobrança (Asaas)</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            {instanciasSemAssinatura.length > 0 && (
              <div className="space-y-3">
                <p className="text-muted-foreground">
                  Cadastre PIX ou cartão para continuar após os 3 dias de demonstração gratuita.
                </p>
                {instanciasSemAssinatura.map((inst) => (
                  <div
                    key={inst.id}
                    className="flex items-center justify-between gap-2 rounded-lg border p-3"
                  >
                    <span className="font-medium">{inst.nome}</span>
                    <Button
                      size="sm"
                      onClick={() => setPagamentoInstancia({ id: inst.id, nome: inst.nome })}
                    >
                      Configurar pagamento
                    </Button>
                  </div>
                ))}
              </div>
            )}
            {assinaturas.isLoading && (
              <p className="text-muted-foreground">Carregando assinaturas...</p>
            )}
            {!assinaturas.isLoading &&
              (assinaturas.data?.assinaturas.length ?? 0) === 0 &&
              instanciasSemAssinatura.length === 0 && (
                <p className="text-muted-foreground">Nenhuma assinatura ativa.</p>
              )}
            {assinaturas.data?.assinaturas.map((item) => (
              <div key={item.instanciaId} className="space-y-2 rounded-lg border p-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-medium">{item.instanciaNome}</p>
                    <p className="text-xs text-muted-foreground">
                      Assinatura: {item.statusAssinatura} · WhatsApp: {item.statusInstancia}
                    </p>
                  </div>
                  {item.statusInstancia !== "deactivated" && (
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={cancelar.isPending}
                      onClick={() => cancelar.mutate({ instanciaId: item.instanciaId })}
                    >
                      Cancelar
                    </Button>
                  )}
                </div>
                {item.cobrancasPendentes.length > 0 && (
                  <ul className="space-y-1 text-xs">
                    {item.cobrancasPendentes.map((cobranca) => (
                      <li key={cobranca.id} className="flex items-center justify-between gap-2">
                        <span>
                          R$ {cobranca.valor.toFixed(2)} · venc. {cobranca.vencimento} (
                          {cobranca.status})
                        </span>
                        {cobranca.urlFatura && (
                          <a
                            href={cobranca.urlFatura}
                            target="_blank"
                            rel="noreferrer"
                            className="text-wa-green underline"
                          >
                            Pagar
                          </a>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      )}
      {pagamentoInstancia && (
        <ConfigurarPagamentoDialog
          open={Boolean(pagamentoInstancia)}
          onOpenChange={(open) => !open && setPagamentoInstancia(null)}
          instanciaId={pagamentoInstancia.id}
          instanciaNome={pagamentoInstancia.nome}
        />
      )}
    </div>
  );
}
