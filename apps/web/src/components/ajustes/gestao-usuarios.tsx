import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { type ReactNode, useState } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@whasap/ui/components/alert-dialog";
import { Badge } from "@whasap/ui/components/badge";
import { Button } from "@whasap/ui/components/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@whasap/ui/components/select";

import { useSession } from "@/lib/auth";
import { orgInput } from "@/lib/org-input";
import { orpc } from "@/lib/orpc";
import { getOrpcErrorMessage } from "@/lib/orpc-error";
import { useOrganizacaoHash } from "@/lib/use-organizacao-hash";

type Papel = "admin" | "usuario" | "analista";

function formatarData(iso: string | null | undefined) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
}

const rotulosPapel: Record<Papel, string> = {
  admin: "Admin",
  usuario: "Usuário",
  analista: "Analista",
};

type GestaoUsuariosProps = {
  /** Slot para ação de convite (controlada pela rota via search param). */
  acaoConvidar?: ReactNode;
};

/**
 * Gestão admin de membros da organização: lista, papel e remoção.
 */
export function GestaoUsuarios({ acaoConvidar }: GestaoUsuariosProps) {
  const { data: session } = useSession();
  const queryClient = useQueryClient();
  const organizacaoHash = useOrganizacaoHash();

  const [membroRemoverId, setMembroRemoverId] = useState<string | null>(null);

  const org = useQuery(
    orpc.organizacao.obter.queryOptions({
      input: orgInput(organizacaoHash),
    }),
  );

  const isAdmin = org.data?.meuPapel === "admin";

  const membros = useQuery(
    orpc.organizacao.membros.lista.queryOptions({
      input: orgInput(organizacaoHash),
    }),
  );

  const convites = useQuery(
    orpc.organizacao.convites.lista.queryOptions({
      input: orgInput(organizacaoHash),
      enabled: isAdmin,
    }),
  );

  const invalidarMembros = () => {
    if (!organizacaoHash) return;
    void queryClient.invalidateQueries({
      queryKey: orpc.organizacao.membros.lista.key({
        input: { organizacaoHash },
      }),
    });
  };

  const atualizarPapel = useMutation(
    orpc.organizacao.membros.atualizarPapel.mutationOptions({
      onSuccess: invalidarMembros,
    }),
  );

  const desativar = useMutation(
    orpc.organizacao.membros.desativar.mutationOptions({
      onSuccess: () => {
        setMembroRemoverId(null);
        invalidarMembros();
      },
    }),
  );

  if (!organizacaoHash) return null;

  if (org.isPending) {
    return <p className="p-6 text-sm text-wa-text-muted">Carregando…</p>;
  }

  if (!isAdmin) {
    return (
      <div className="p-6">
        <h2 className="text-lg font-semibold text-wa-text">Usuários</h2>
        <p className="mt-2 text-sm text-wa-text-muted">Acesso restrito a administradores.</p>
      </div>
    );
  }

  const membroRemover = (membros.data ?? []).find((m) => m.id === membroRemoverId);
  const convitesPendentes = (convites.data ?? []).filter((c) => !c.aceitoEm);

  return (
    <div className="space-y-8 p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-wa-text">Usuários</h2>
          <p className="mt-1 text-sm text-wa-text-muted">
            Convide membros, altere papéis e acompanhe atividade no painel.
          </p>
        </div>
        {acaoConvidar}
      </div>

      <section className="space-y-3">
        <h3 className="text-sm font-medium text-wa-text">Membros</h3>
        {(membros.data ?? []).length === 0 ? (
          <p className="text-sm text-wa-text-muted">Nenhum membro.</p>
        ) : (
          <ul className="divide-y divide-wa-divider rounded-lg border border-wa-divider">
            {(membros.data ?? []).map((m) => {
              const ehEu = m.usuarioId === session?.usuario?.id;
              return (
                <li
                  key={m.id}
                  className="flex flex-col gap-3 p-3 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0 space-y-1">
                    <p className="truncate text-sm font-medium text-wa-text">
                      {m.usuarioNome ?? m.usuarioEmail ?? m.usuarioId}
                      {ehEu ? (
                        <span className="ml-2 text-xs font-normal text-wa-text-muted">(você)</span>
                      ) : null}
                    </p>
                    {m.usuarioEmail ? (
                      <p className="truncate text-xs text-wa-text-muted">{m.usuarioEmail}</p>
                    ) : null}
                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-wa-text-muted">
                      <span>Ativo: {formatarData(m.ultimaAtividadeEm)}</span>
                      <span>Última msg: {formatarData(m.ultimaMensagemEnviadaEm)}</span>
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    {ehEu ? (
                      <Badge variant="secondary">{rotulosPapel[m.role]}</Badge>
                    ) : (
                      <>
                        <Select
                          value={m.role}
                          onValueChange={(v) =>
                            atualizarPapel.mutate({
                              membroId: m.id,
                              role: v as Papel,
                            })
                          }
                          disabled={atualizarPapel.isPending}
                        >
                          <SelectTrigger className="w-32">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="admin">Admin</SelectItem>
                            <SelectItem value="usuario">Usuário</SelectItem>
                            <SelectItem value="analista">Analista</SelectItem>
                          </SelectContent>
                        </Select>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setMembroRemoverId(m.id)}
                          disabled={desativar.isPending}
                        >
                          Remover
                        </Button>
                      </>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
        {atualizarPapel.isError ? (
          <p className="text-sm text-destructive">
            {getOrpcErrorMessage(atualizarPapel.error, "Não foi possível alterar o papel.")}
          </p>
        ) : null}
        {desativar.isError ? (
          <p className="text-sm text-destructive">
            {getOrpcErrorMessage(desativar.error, "Não foi possível remover o usuário.")}
          </p>
        ) : null}
      </section>

      {convitesPendentes.length > 0 ? (
        <section className="space-y-3">
          <h3 className="text-sm font-medium text-wa-text">Convites pendentes</h3>
          <ul className="divide-y divide-wa-divider rounded-lg border border-wa-divider">
            {convitesPendentes.map((c) => (
              <li key={c.id} className="flex items-center justify-between gap-3 p-3 text-sm">
                <div className="min-w-0">
                  <p className="truncate text-wa-text">{c.email}</p>
                  <p className="text-xs text-wa-text-muted">Expira {formatarData(c.expiraEm)}</p>
                </div>
                <Badge variant="outline">{rotulosPapel[c.role]}</Badge>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <AlertDialog
        open={membroRemoverId != null}
        onOpenChange={(open) => {
          if (!open) setMembroRemoverId(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover usuário?</AlertDialogTitle>
            <AlertDialogDescription>
              {membroRemover
                ? `${membroRemover.usuarioNome ?? membroRemover.usuarioEmail ?? "Este membro"} perderá o acesso a esta organização.`
                : "Este membro perderá o acesso a esta organização."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={desativar.isPending}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              disabled={desativar.isPending || !membroRemoverId}
              onClick={(e) => {
                e.preventDefault();
                if (membroRemoverId) desativar.mutate({ membroId: membroRemoverId });
              }}
            >
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
