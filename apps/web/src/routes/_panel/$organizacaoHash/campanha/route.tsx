import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Navigate, Outlet } from "@tanstack/react-router";

import { WaCampanhaPanelNav } from "@/components/campanha/wa-campanha-panel-nav";
import { orgInput } from "@/lib/org-input";
import { orpc } from "@/lib/orpc";
import { useOrganizacaoHash } from "@/lib/use-organizacao-hash";

export const Route = createFileRoute("/_panel/$organizacaoHash/campanha")({
  component: CampanhaLayout,
});

function CampanhaLayout() {
  const organizacaoHash = useOrganizacaoHash();
  const org = useQuery(
    orpc.organizacao.obter.queryOptions({
      input: orgInput(organizacaoHash),
    }),
  );

  if (!organizacaoHash) return null;

  if (org.isSuccess && !org.data.campanhaHabilitada) {
    return <Navigate to="/$organizacaoHash" params={{ organizacaoHash }} replace />;
  }

  return (
    <div className="flex h-full min-h-0 w-full overflow-hidden">
      <WaCampanhaPanelNav organizacaoHash={organizacaoHash} />
      <main className="min-w-0 flex-1 overflow-auto">
        <Outlet />
      </main>
    </div>
  );
}
