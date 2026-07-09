import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";

import { orpc } from "@/lib/orpc";

export const Route = createFileRoute("/_admin/administracao/instancias/$instanciaId")({
  component: InstanciaEvolutionPage,
});

function InstanciaEvolutionPage() {
  const { instanciaId } = Route.useParams();

  const estado = useQuery(
    orpc.administracao.instancias.estadoEvolution.queryOptions({
      input: { instanciaId },
    }),
  );

  return (
    <div className="space-y-6">
      <div>
        <Link to="/administracao/webhooks" className="text-sm text-primary underline">
          ← Webhooks
        </Link>
        <h1 className="mt-2 text-2xl font-semibold">Estado Evolution</h1>
        <p className="font-mono text-sm text-muted-foreground">{instanciaId}</p>
      </div>

      {estado.isLoading ? <p className="text-sm text-muted-foreground">Carregando…</p> : null}
      {estado.isError ? (
        <p className="text-sm text-destructive">
          {estado.error instanceof Error ? estado.error.message : "Erro"}
        </p>
      ) : null}

      {estado.data ? (
        <div className="grid gap-4 md:grid-cols-2">
          <section className="rounded-md border p-4">
            <h2 className="font-medium">Banco de dados</h2>
            <pre className="mt-2 overflow-auto text-xs">{JSON.stringify(estado.data.instanciaDb, null, 2)}</pre>
          </section>
          <section className="rounded-md border p-4">
            <h2 className="font-medium">Evolution API (ao vivo)</h2>
            <p className="mt-1 text-sm">
              Estado parseado:{" "}
              <strong>{estado.data.evolution.estado ?? "—"}</strong>
            </p>
            {estado.data.evolution.erro ? (
              <p className="mt-2 text-sm text-destructive">{estado.data.evolution.erro}</p>
            ) : null}
            <pre className="mt-2 max-h-96 overflow-auto text-xs">
              {JSON.stringify(
                {
                  statusBruto: estado.data.evolution.statusBruto,
                  qrBruto: estado.data.evolution.qrBruto,
                },
                null,
                2,
              )}
            </pre>
          </section>
        </div>
      ) : null}

      <p className="text-sm text-muted-foreground">
        Na página de webhooks, filtre pelo UUID acima para ver eventos desta instância.
      </p>
    </div>
  );
}
