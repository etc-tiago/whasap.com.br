import { Link, Outlet, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@whasap/ui/components/button";
import { Badge } from "@whasap/ui/components/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@whasap/ui/components/select";
import { MessageCircle, LogOut, Settings, Smartphone, BarChart3, Users, Plus } from "lucide-react";
import type { ReactNode } from "react";

import { useSession } from "@/lib/auth";
import { orpc, orpcClient } from "@/lib/orpc";

type OrganizacaoComPapel = Awaited<ReturnType<typeof orpcClient.organizacao.obter>>;

export function PanelShell({
  children,
  organizacao,
}: {
  children?: ReactNode;
  organizacao: OrganizacaoComPapel;
}) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data: session } = useSession();
  const organizacaoHash = organizacao.id;

  const orgs = useQuery(orpc.organizacao.lista.queryOptions());

  const logout = useMutation(
    orpc.autenticacao.sair.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: orpc.autenticacao.eu.key() });
      },
    }),
  );

  return (
    <div className="flex min-h-screen bg-background">
      <aside className="flex w-56 flex-col border-r border-border bg-card">
        <div className="flex items-center gap-2 border-b border-border px-4 py-4">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-wa-green text-white">
            <MessageCircle className="h-4 w-4 fill-white" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold">Whasap</p>
            {(orgs.data?.length ?? 0) > 1 ? (
              <Select
                value={organizacaoHash}
                onValueChange={(value) =>
                  navigate({ to: "/$organizacaoHash", params: { organizacaoHash: value } })
                }
              >
                <SelectTrigger className="mt-1 h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {orgs.data?.map((org) => (
                    <SelectItem key={org.id} value={org.id}>
                      {org.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <p className="truncate text-xs text-muted-foreground">{organizacao.nome}</p>
            )}
            <Badge variant="outline" className="mt-1 text-[10px]">
              {organizacao.meuPapel}
            </Badge>
          </div>
        </div>
        <nav className="flex flex-1 flex-col gap-1 p-2">
          <Link
            to="/$organizacaoHash"
            params={{ organizacaoHash }}
            className="flex items-center gap-2 rounded-md px-3 py-2 text-sm hover:bg-accent"
          >
            <MessageCircle className="h-4 w-4" />
            Inbox
          </Link>
          <Link
            to="/$organizacaoHash/instancias"
            params={{ organizacaoHash }}
            className="flex items-center gap-2 rounded-md px-3 py-2 text-sm hover:bg-accent"
          >
            <Smartphone className="h-4 w-4" />
            Instâncias
          </Link>
          <Link
            to="/$organizacaoHash/relatorios"
            params={{ organizacaoHash }}
            className="flex items-center gap-2 rounded-md px-3 py-2 text-sm hover:bg-accent"
          >
            <BarChart3 className="h-4 w-4" />
            Relatórios
          </Link>
          {organizacao.meuPapel === "admin" && (
            <Link
              to="/$organizacaoHash/equipe"
              params={{ organizacaoHash }}
              className="flex items-center gap-2 rounded-md px-3 py-2 text-sm hover:bg-accent"
            >
              <Users className="h-4 w-4" />
              Equipe
            </Link>
          )}
          <Link
            to="/$organizacaoHash/ajustes"
            params={{ organizacaoHash }}
            className="flex items-center gap-2 rounded-md px-3 py-2 text-sm hover:bg-accent"
          >
            <Settings className="h-4 w-4" />
            Ajustes
          </Link>
          <Link
            to="/integracao"
            className="mt-2 flex items-center gap-2 rounded-md px-3 py-2 text-sm text-muted-foreground hover:bg-accent"
          >
            <Plus className="h-4 w-4" />
            Nova organização
          </Link>
        </nav>
        <div className="border-t border-border p-2">
          <p className="truncate px-3 py-1 text-xs text-muted-foreground">
            {session?.usuario?.email}
          </p>
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-start gap-2"
            disabled={logout.isPending}
            onClick={() => logout.mutate({})}
          >
            <LogOut className="h-4 w-4" />
            Sair
          </Button>
        </div>
      </aside>
      <main className="flex-1 overflow-auto">{children ?? <Outlet />}</main>
    </div>
  );
}
