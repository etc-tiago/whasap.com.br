import { createFileRoute, Outlet, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef } from "react";

import { useSession } from "@/lib/auth";
import { eSessaoNaoAutorizada } from "@/lib/orpc-error";
import { limparEstadoClienteSessao } from "@/lib/sessao-cliente";
import { useAtividadeHeartbeat } from "@/lib/use-atividade-heartbeat";

export const Route = createFileRoute("/_panel")({
  component: PanelGate,
});

function PanelGate() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data: session, isPending, error, isError } = useSession();
  // React Query mantém `data` stale após refetch com erro — 401 precisa invalidar o gate.
  const sessaoExpirada = isError && eSessaoNaoAutorizada(error);
  const autenticado = Boolean(session?.usuario) && !sessaoExpirada;
  const tinhaSessao = useRef(false);

  useAtividadeHeartbeat(autenticado);

  useEffect(() => {
    if (autenticado) {
      tinhaSessao.current = true;
      return;
    }
    if (isPending) return;

    if (tinhaSessao.current || sessaoExpirada) {
      tinhaSessao.current = false;
      void limparEstadoClienteSessao(queryClient);
    }

    void navigate({ to: "/~", replace: true });
  }, [autenticado, isPending, sessaoExpirada, navigate, queryClient]);

  if (isPending || !autenticado) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background text-sm text-muted-foreground">
        Aguarde...
      </div>
    );
  }

  return <Outlet />;
}
