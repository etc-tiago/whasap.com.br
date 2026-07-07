import { createFileRoute, Outlet } from "@tanstack/react-router";

import { AuthPage } from "@/components/auth-page";
import { useSession } from "@/lib/auth";

export const Route = createFileRoute("/_panel")({
  component: PanelGate,
});

function PanelGate() {
  const { data: session, isPending } = useSession();

  if (isPending) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background text-sm text-muted-foreground">
        Aguarde...
      </div>
    );
  }

  if (!session?.usuario) {
    return <AuthPage />;
  }

  return <Outlet />;
}
