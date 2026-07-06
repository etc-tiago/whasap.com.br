import { Link, Outlet } from "@tanstack/react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@whasap/ui/components/button";
import { Badge } from "@whasap/ui/components/badge";
import {
  MessageCircle,
  LogOut,
  Settings,
  Smartphone,
  BarChart3,
  Users,
} from "lucide-react";
import type { ReactNode } from "react";

import { useSession } from "@/lib/auth";
import { orpc } from "@/lib/orpc";

export function PanelShell({ children }: { children?: ReactNode }) {
  const queryClient = useQueryClient();
  const { data: session } = useSession();
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
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold">Whasap</p>
            <p className="truncate text-xs text-muted-foreground">
              {session?.organizacao?.nome ?? "Sem organização"}
            </p>
            {session?.organizacao && (
              <Badge variant="outline" className="mt-1 text-[10px]">
                {session.role}
              </Badge>
            )}
          </div>
        </div>
        <nav className="flex flex-1 flex-col gap-1 p-2">
          <Link
            to="/"
            className="flex items-center gap-2 rounded-md px-3 py-2 text-sm hover:bg-accent"
          >
            <MessageCircle className="h-4 w-4" />
            Inbox
          </Link>
          <Link
            to="/instancias"
            className="flex items-center gap-2 rounded-md px-3 py-2 text-sm hover:bg-accent"
          >
            <Smartphone className="h-4 w-4" />
            Instâncias
          </Link>
          <Link
            to="/relatorios"
            className="flex items-center gap-2 rounded-md px-3 py-2 text-sm hover:bg-accent"
          >
            <BarChart3 className="h-4 w-4" />
            Relatórios
          </Link>
          {session?.role === "admin" && (
            <Link
              to="/equipe"
              className="flex items-center gap-2 rounded-md px-3 py-2 text-sm hover:bg-accent"
            >
              <Users className="h-4 w-4" />
              Equipe
            </Link>
          )}
          <Link
            to="/ajustes"
            className="flex items-center gap-2 rounded-md px-3 py-2 text-sm hover:bg-accent"
          >
            <Settings className="h-4 w-4" />
            Ajustes
          </Link>
        </nav>
        <div className="border-t border-border p-2">
          <p className="truncate px-3 py-1 text-xs text-muted-foreground">{session?.usuario?.email}</p>
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
