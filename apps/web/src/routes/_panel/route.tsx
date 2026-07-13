import { createFileRoute, Outlet, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";

import { useSession } from "@/lib/auth";
import { useAtividadeHeartbeat } from "@/lib/use-atividade-heartbeat";

export const Route = createFileRoute("/_panel")({
  component: PanelGate,
});

function PanelGate() {
  const navigate = useNavigate();
  const { data: session, isPending } = useSession();
  const autenticado = Boolean(session?.usuario);

  useAtividadeHeartbeat(autenticado);

  useEffect(() => {
    if (!isPending && !session?.usuario) {
      void navigate({ to: "/~", replace: true });
    }
  }, [isPending, session?.usuario, navigate]);

  if (isPending || !session?.usuario) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background text-sm text-muted-foreground">
        Aguarde...
      </div>
    );
  }

  return <Outlet />;
}
