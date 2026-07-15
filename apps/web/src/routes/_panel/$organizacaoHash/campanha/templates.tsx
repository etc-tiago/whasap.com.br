import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Button } from "@whasap/ui/components/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@whasap/ui/components/card";
import { Trash2 } from "lucide-react";

import { orgInput } from "@/lib/org-input";
import { orpc } from "@/lib/orpc";
import { getOrpcErrorMessage } from "@/lib/orpc-error";
import { useOrganizacaoHash } from "@/lib/use-organizacao-hash";

export const Route = createFileRoute("/_panel/$organizacaoHash/campanha/templates")({
  component: CampanhaTemplatesPage,
});

function CampanhaTemplatesPage() {
  const organizacaoHash = useOrganizacaoHash();
  const queryClient = useQueryClient();

  const org = useQuery(
    orpc.organizacao.obter.queryOptions({
      input: orgInput(organizacaoHash),
    }),
  );
  const isAdmin = org.data?.meuPapel === "admin";

  const lista = useQuery(
    orpc.campanha.templatesMemorizados.lista.queryOptions({
      input: orgInput(organizacaoHash),
    }),
  );

  const remover = useMutation(
    orpc.campanha.templatesMemorizados.remover.mutationOptions({
      onSuccess: async () => {
        await queryClient.invalidateQueries({
          queryKey: orpc.campanha.templatesMemorizados.lista.key(),
        });
      },
    }),
  );

  if (!organizacaoHash) return null;

  return (
    <div className="mx-auto max-w-2xl space-y-6 p-6">
      <div>
        <h2 className="text-lg font-semibold text-wa-text">Templates salvos</h2>
        <p className="mt-1 text-sm text-wa-text-muted">
          Modelos da Cloud API memorizados com variáveis preenchidas para reutilização.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Memorizados</CardTitle>
          <CardDescription>
            Salve a partir do painel ou do envio rápido ao configurar as variáveis.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {lista.isLoading ? (
            <p className="text-sm text-muted-foreground">Carregando…</p>
          ) : (lista.data?.length ?? 0) === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum template memorizado.</p>
          ) : (
            <ul className="divide-y divide-border">
              {lista.data!.map((item) => (
                <li key={item.id} className="flex items-center justify-between gap-3 py-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-wa-text">{item.nome}</p>
                    <p className="text-xs text-muted-foreground">
                      {item.templateNome} · {item.templateIdioma}
                    </p>
                  </div>
                  {isAdmin ? (
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      disabled={remover.isPending}
                      onClick={() =>
                        remover.mutate({ organizacaoHash, id: item.id })
                      }
                      aria-label={`Remover ${item.nome}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
          {remover.error ? (
            <p className="text-sm text-destructive">
              {getOrpcErrorMessage(remover.error, "Não foi possível remover.")}
            </p>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
