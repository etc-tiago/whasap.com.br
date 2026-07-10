import { createFileRoute, Outlet } from "@tanstack/react-router";

import { WaAjustesPanel } from "@/components/inbox/wa-ajustes-panel";
import { useOrganizacaoHash } from "@/lib/use-organizacao-hash";

export const Route = createFileRoute("/_panel/$organizacaoHash/ajustes")({
  component: AjustesLayout,
});

function AjustesLayout() {
  const organizacaoHash = useOrganizacaoHash();

  if (!organizacaoHash) return null;

  return (
    <div className="flex h-full min-h-0 w-full overflow-hidden">
      <WaAjustesPanel organizacaoHash={organizacaoHash} />
      <main className="min-w-0 flex-1 overflow-auto">
        <Outlet />
      </main>
    </div>
  );
}
