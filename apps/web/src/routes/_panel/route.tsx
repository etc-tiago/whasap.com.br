import { createFileRoute, Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import { skipToken, useQuery } from "@tanstack/react-query";
import { useEffect } from "react";

import { AuthPage } from "@/components/auth-page";
import { PanelShell } from "@/components/panel-shell";
import { useSession } from "@/lib/auth";
import { orpc } from "@/lib/orpc";

export const Route = createFileRoute("/_panel")({
  component: PanelGate,
});

function isOperational(
  instances: Array<{ status: string; asaasSubscriptionId: string | null }>,
): boolean {
  return instances.some((i) => i.status === "connected" && i.asaasSubscriptionId);
}

function PanelGate() {
  const { data: session, isPending } = useSession();
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const orgId = session?.organizacao?.id;

  const instances = useQuery(
    orpc.instancia.lista.queryOptions({
      input: orgId ? { organizacaoId: orgId } : skipToken,
    }),
  );

  const onboardingComplete = instances.data ? isOperational(instances.data) : false;
  const exemptPaths = ["/onboarding", "/ajustes"];
  const needsOnboarding =
    session?.usuario &&
    orgId &&
    instances.isSuccess &&
    !onboardingComplete &&
    !exemptPaths.some((p) => pathname.startsWith(p));

  useEffect(() => {
    if (needsOnboarding) {
      navigate({ to: "/onboarding", search: { instance: "", step: "" } });
    }
  }, [needsOnboarding, navigate]);

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

  return (
    <PanelShell>
      <Outlet />
    </PanelShell>
  );
}
