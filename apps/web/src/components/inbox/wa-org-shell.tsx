import { Outlet } from "@tanstack/react-router";
import type { ReactNode } from "react";

import { WaRail } from "@/components/inbox/wa-rail";

type WaOrgShellProps = {
  organizacaoHash: string;
  children?: ReactNode;
};

export function WaOrgShell({ organizacaoHash, children }: WaOrgShellProps) {
  return (
    <div className="wa-app flex h-full min-h-0 w-full overflow-hidden bg-wa-panel">
      <WaRail organizacaoHash={organizacaoHash} />
      <div className="flex min-h-0 min-w-0 flex-1 overflow-hidden">{children ?? <Outlet />}</div>
    </div>
  );
}
