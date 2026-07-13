import { Outlet, useRouterState } from "@tanstack/react-router";
import type { ReactNode } from "react";

import { WaBackdrop } from "@/components/wa-backdrop";

type OrganizacaoComPapel = {
  id: string;
};

export function PanelShell({
  children,
}: {
  children?: ReactNode;
  organizacao: OrganizacaoComPapel;
}) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const comWallpaper = pathname.endsWith("/integracao");

  return (
    <div className="relative flex h-dvh flex-col overflow-hidden bg-wa-bg">
      {comWallpaper && <WaBackdrop />}
      <main className="relative min-h-0 flex-1 overflow-hidden">{children ?? <Outlet />}</main>
    </div>
  );
}
