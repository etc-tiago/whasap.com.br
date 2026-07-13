import { createFileRoute, Outlet } from "@tanstack/react-router";

import { WaAcoesPanel } from "@/components/inbox/wa-acoes-panel";
import { useOrganizacaoHash } from "@/lib/use-organizacao-hash";

export const Route = createFileRoute("/_panel/$organizacaoHash/acoes")({
  component: AcoesLayout,
});

function AcoesLayout() {
  const organizacaoHash = useOrganizacaoHash();

  if (!organizacaoHash) return null;

  return (
    <div className="flex h-full min-h-0 w-full overflow-hidden">
      <WaAcoesPanel organizacaoHash={organizacaoHash} />
      <main className="min-w-0 flex-1 overflow-auto">
        <Outlet />
      </main>
    </div>
  );
}
