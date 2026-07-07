import { createFileRoute, Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";

import { PanelShell } from "@/components/panel-shell";
import { orgInput } from "@/lib/org-input";
import { orpc } from "@/lib/orpc";
import { useOrganizacaoHash } from "@/lib/use-organizacao-hash";

export const Route = createFileRoute("/_panel/$organizacaoHash")({
  component: OrganizacaoLayout,
});

function isOperational(
  instances: Array<{ status: string; asaasSubscriptionId: string | null }>,
): boolean {
  return instances.some((i) => i.status === "connected" && i.asaasSubscriptionId);
}

function OrganizacaoLayout() {
  const organizacaoHash = useOrganizacaoHash();
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  const org = useQuery(
    orpc.organizacao.obter.queryOptions({
      input: orgInput(organizacaoHash),
    }),
  );

  const instances = useQuery(
    orpc.instancia.lista.queryOptions({
      input: orgInput(organizacaoHash),
    }),
  );

  const onboardingComplete = instances.data ? isOperational(instances.data) : false;
  const integracaoPath = organizacaoHash ? `/${organizacaoHash}/integracao` : "";
  const ajustesPath = organizacaoHash ? `/${organizacaoHash}/ajustes` : "";
  const exemptPaths = [integracaoPath, ajustesPath];
  const needsOnboarding =
    Boolean(organizacaoHash) &&
    org.isSuccess &&
    instances.isSuccess &&
    !onboardingComplete &&
    !exemptPaths.some((p) => pathname.startsWith(p));

  useEffect(() => {
    if (!needsOnboarding || !organizacaoHash) return;
    navigate({
      to: "/$organizacaoHash/integracao",
      params: { organizacaoHash },
      search: { instance: "", step: "" },
    });
  }, [needsOnboarding, navigate, organizacaoHash]);

  if (org.isError) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background text-sm text-muted-foreground">
        Organização não encontrada ou sem acesso.
      </div>
    );
  }

  if (org.isPending) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background text-sm text-muted-foreground">
        Aguarde...
      </div>
    );
  }

  return (
    <PanelShell organizacao={org.data}>
      <Outlet />
    </PanelShell>
  );
}
