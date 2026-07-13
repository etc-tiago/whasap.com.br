import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { isEvoProvider } from "@whasap/config";
import { Badge } from "@whasap/ui/components/badge";
import { Button } from "@whasap/ui/components/button";

import { IconeConexaoLucide } from "@/lib/icones-conexao";
import { historicoSyncEmAndamento, rotuloHistoricoSync } from "@/lib/historico-sync";
import { instanciaOperacional, rotulosStatusInstancia } from "@/lib/instancia-status";
import { orgInput } from "@/lib/org-input";
import { orpc, type InstanciaItem } from "@/lib/orpc";
import { getOrpcErrorMessage } from "@/lib/orpc-error";
import { useOrganizacaoHash } from "@/lib/use-organizacao-hash";

export const Route = createFileRoute("/_panel/$organizacaoHash/ajustes/conexao")({
  component: AjustesConexaoPage,
});

function AjustesConexaoPage() {
  const organizacaoHash = useOrganizacaoHash();
  const queryClient = useQueryClient();

  const org = useQuery(
    orpc.organizacao.obter.queryOptions({
      input: orgInput(organizacaoHash),
    }),
  );

  const instances = useQuery({
    ...orpc.instancia.lista.queryOptions({
      input: orgInput(organizacaoHash),
    }),
    refetchInterval: (q) => {
      const lista = q.state.data ?? [];
      return lista.some((i) => historicoSyncEmAndamento(i)) ? 5_000 : false;
    },
  });

  const sincronizar = useMutation(
    orpc.instancia.sincronizarHistorico.mutationOptions({
      onSuccess: async () => {
        if (!organizacaoHash) return;
        await queryClient.invalidateQueries({
          queryKey: orpc.instancia.lista.key({ input: { organizacaoHash } }),
        });
      },
    }),
  );

  if (!organizacaoHash) return null;

  const lista = instances.data ?? [];
  const isAdmin = org.data?.meuPapel === "admin";
  const conectadas = lista.filter((i) => instanciaOperacional(i.status));

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-wa-text">Conexões</h2>
          <p className="mt-1 text-sm text-wa-text-muted">
            {lista.length === 0
              ? "Nenhuma conexão cadastrada ainda."
              : `${lista.length} conexão${lista.length === 1 ? "" : "ões"} · ${conectadas.length} conectada${conectadas.length === 1 ? "" : "s"}`}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline" size="sm">
            <Link to="/$organizacaoHash/instancias" params={{ organizacaoHash }}>
              Gerenciar
            </Link>
          </Button>
          {isAdmin ? (
            <Button asChild size="sm">
              <Link
                to="/$organizacaoHash/integracao"
                params={{ organizacaoHash }}
                search={{ instance: "", step: "", modo: "novo" }}
              >
                Adicionar
              </Link>
            </Button>
          ) : null}
        </div>
      </div>

      {instances.isLoading ? (
        <p className="text-sm text-wa-text-muted">Carregando…</p>
      ) : lista.length === 0 ? (
        <p className="text-sm text-wa-text-muted">
          Use <strong>Adicionar</strong> para criar a primeira conexão WhatsApp.
        </p>
      ) : (
        <ul className="divide-y divide-wa-divider rounded-lg border border-wa-divider">
          {lista.map((inst) => (
            <ConexaoLinha
              key={inst.id}
              inst={inst}
              isAdmin={isAdmin}
              syncPending={sincronizar.isPending && sincronizar.variables?.instanciaId === inst.id}
              syncError={
                sincronizar.variables?.instanciaId === inst.id ? sincronizar.error : null
              }
              onSync={() => sincronizar.mutate({ instanciaId: inst.id })}
            />
          ))}
        </ul>
      )}
    </div>
  );
}

function ConexaoLinha({
  inst,
  isAdmin,
  syncPending,
  syncError,
  onSync,
}: {
  inst: InstanciaItem;
  isAdmin: boolean;
  syncPending: boolean;
  syncError: unknown;
  onSync: () => void;
}) {
  const evo = isEvoProvider(inst.provider);
  const syncing = historicoSyncEmAndamento(inst);
  const podeSync =
    isAdmin &&
    evo &&
    (inst.status === "connected" || inst.status === "pending_payment") &&
    !syncing &&
    !syncPending;

  return (
    <li className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:gap-3">
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-wa-hover text-wa-icon">
          <IconeConexaoLucide nome={inst.icone} className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-wa-text">{inst.nome}</p>
          {evo ? (
            <p className="text-xs text-wa-text-muted">
              {rotuloHistoricoSync(inst)}
              {inst.evoHistoricoSyncErro ? ` — ${inst.evoHistoricoSyncErro}` : null}
            </p>
          ) : null}
          {syncError ? (
            <p className="text-xs text-destructive">
              {getOrpcErrorMessage(syncError, "Erro ao sincronizar histórico")}
            </p>
          ) : null}
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant={instanciaOperacional(inst.status) ? "default" : "outline"}>
          {rotulosStatusInstancia[inst.status] ?? inst.status}
        </Badge>
        {evo && isAdmin ? (
          <Button size="sm" variant="outline" disabled={!podeSync} onClick={onSync}>
            {syncing || syncPending ? "Sincronizando…" : "Sincronizar histórico"}
          </Button>
        ) : null}
      </div>
    </li>
  );
}
