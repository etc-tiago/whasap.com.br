import { createFileRoute, Outlet, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";

import { useSession } from "@/lib/auth";

export const Route = createFileRoute("/_panel")({
  component: PanelGate,
});

function PanelGate() {
  const navigate = useNavigate();
  const { data: session, isPending } = useSession();

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
