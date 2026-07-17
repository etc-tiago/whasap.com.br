import type { ReactNode } from "react";

import { LogoWhasap } from "@/components/logo-whasap";

type EntradaShellProps = {
  title?: string;
  description?: string;
  children: ReactNode;
};

export function EntradaShell({ title, description, children }: EntradaShellProps) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-md space-y-6">
        <div className="flex flex-col items-center gap-2 text-center">
          <LogoWhasap variante="verde" className="h-12" decorative />
          <h1 className="text-2xl font-semibold">{title ?? "Whasap"}</h1>
          {description ? <p className="text-sm text-muted-foreground">{description}</p> : null}
        </div>
        {children}
      </div>
    </div>
  );
}
