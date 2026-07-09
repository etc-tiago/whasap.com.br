import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@whasap/ui/components/button";
import { Input } from "@whasap/ui/components/input";
import { useState } from "react";

import { orpc } from "@/lib/orpc";

export const Route = createFileRoute("/_admin/administracao/webhooks")({
  component: WebhooksPage,
});

function WebhooksPage() {
  const [instanciaId, setInstanciaId] = useState("");
  const [filtroInstancia, setFiltroInstancia] = useState<string | undefined>();
  const [detalheId, setDetalheId] = useState<number | null>(null);

  const lista = useQuery(
    orpc.administracao.webhooks.lista.queryOptions({
      input: {
        limite: 50,
        offset: 0,
        origem: "evo",
        instanciaId: filtroInstancia,
      },
    }),
  );

  const detalhe = useQuery(
    orpc.administracao.webhooks.obter.queryOptions({
      input: { id: detalheId! },
      enabled: detalheId !== null,
    }),
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Webhooks Evolution</h1>
        <p className="text-sm text-muted-foreground">
          Eventos persistidos em <code>webhook_evento</code> e R2.
        </p>
      </div>

      <div className="flex flex-wrap items-end gap-2">
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground" htmlFor="instancia-filter">
            Filtrar por instanciaId (UUID)
          </label>
          <Input
            id="instancia-filter"
            className="w-80"
            value={instanciaId}
            onChange={(e) => setInstanciaId(e.target.value)}
            placeholder="faeb916b-b1f5-4673-85eb-4ffb18432071"
          />
        </div>
        <Button
          variant="secondary"
          onClick={() => setFiltroInstancia(instanciaId.trim() || undefined)}
        >
          Filtrar
        </Button>
        <Button variant="outline" onClick={() => lista.refetch()}>
          Atualizar
        </Button>
      </div>

      {lista.isError ? (
        <p className="text-sm text-destructive">
          {lista.error instanceof Error ? lista.error.message : "Erro ao carregar"}
        </p>
      ) : null}

      <div className="overflow-x-auto rounded-md border">
        <table className="w-full text-left text-sm">
          <thead className="border-b bg-muted/40">
            <tr>
              <th className="px-3 py-2">ID</th>
              <th className="px-3 py-2">Evento</th>
              <th className="px-3 py-2">Instância ref</th>
              <th className="px-3 py-2">Criado</th>
              <th className="px-3 py-2">Processado</th>
              <th className="px-3 py-2" />
            </tr>
          </thead>
          <tbody>
            {lista.data?.itens.map((item) => (
              <tr key={item.id} className="border-b last:border-0">
                <td className="px-3 py-2 font-mono text-xs">{item.id}</td>
                <td className="px-3 py-2">{item.evento ?? "—"}</td>
                <td className="px-3 py-2 font-mono text-xs">{item.instanciaRef ?? "—"}</td>
                <td className="px-3 py-2 text-xs">{item.criadoEm}</td>
                <td className="px-3 py-2 text-xs">{item.processadoEm ?? "pendente"}</td>
                <td className="px-3 py-2">
                  <Button size="sm" variant="outline" onClick={() => setDetalheId(item.id)}>
                    Ver
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {detalheId !== null && detalhe.data ? (
        <details open className="rounded-md border bg-muted/20 p-4">
          <summary className="cursor-pointer font-medium">Webhook #{detalheId}</summary>
          <pre className="mt-3 max-h-96 overflow-auto whitespace-pre-wrap break-all text-xs">
            {JSON.stringify(
              { payload: detalhe.data.payload, r2: detalhe.data.r2Conteudo },
              null,
              2,
            )}
          </pre>
        </details>
      ) : null}

      {filtroInstancia ? (
        <p className="text-sm">
          <Link
            to="/administracao/instancias/$instanciaId"
            params={{ instanciaId: filtroInstancia }}
            className="text-primary underline"
          >
            Ver estado Evolution desta instância
          </Link>
        </p>
      ) : null}
    </div>
  );
}
