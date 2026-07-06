import { createFileRoute } from "@tanstack/react-router";
import { skipToken, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@whasap/ui/components/button";
import { Card, CardContent, CardHeader, CardTitle } from "@whasap/ui/components/card";

import { useSession } from "@/lib/auth";
import { orpc } from "@/lib/orpc";

export const Route = createFileRoute("/_panel/ajustes")({
  component: AjustesPage,
});

function AjustesPage() {
  const queryClient = useQueryClient();
  const { data: session } = useSession();
  const orgId = session?.organizacao?.id;

  const assinaturas = useQuery(
    orpc.cobranca.assinaturas.queryOptions({
      input: orgId ? { organizacaoId: orgId } : skipToken,
      enabled: session?.role === "admin" && Boolean(orgId),
    }),
  );

  const cancelar = useMutation(
    orpc.cobranca.cancelarAssinatura.mutationOptions({
      onSuccess: () => {
        if (orgId) {
          queryClient.invalidateQueries({
            queryKey: orpc.cobranca.assinaturas.key({ input: { organizacaoId: orgId } }),
          });
          queryClient.invalidateQueries({
            queryKey: orpc.instancia.lista.key({ input: { organizacaoId: orgId } }),
          });
        }
      },
    }),
  );

  return (
    <div className="p-6 max-w-lg space-y-6">
      <h1 className="text-2xl font-semibold">Ajustes</h1>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Organização</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <p>
            <span className="text-muted-foreground">Nome:</span> {session?.organizacao?.nome}
          </p>
          <p>
            <span className="text-muted-foreground">Papel:</span> {session?.role}
          </p>
          {session?.organizacao?.documento && (
            <p>
              <span className="text-muted-foreground">CPF/CNPJ:</span>{" "}
              {session.organizacao.documento}
            </p>
          )}
        </CardContent>
      </Card>
      {session?.role === "admin" && orgId && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Cobrança (Asaas)</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            {assinaturas.isLoading && (
              <p className="text-muted-foreground">Carregando assinaturas...</p>
            )}
            {assinaturas.data?.assinaturas.length === 0 && (
              <p className="text-muted-foreground">Nenhuma assinatura ativa.</p>
            )}
            {assinaturas.data?.assinaturas.map((item) => (
              <div key={item.instanciaId} className="space-y-2 rounded-lg border p-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-medium">{item.instanciaNome}</p>
                    <p className="text-xs text-muted-foreground">
                      Assinatura: {item.statusAssinatura} · Instância: {item.statusInstancia}
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
    </div>
  );
}
