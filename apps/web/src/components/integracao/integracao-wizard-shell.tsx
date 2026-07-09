import type { ReactNode } from "react";

import { EntradaProgressDots } from "@/components/entrada/entrada-progress-dots";

type Props = {
  step: string;
  progress: { current: number; total: number };
  children: ReactNode;
};

export function IntegracaoWizardShell({ step, progress, children }: Props) {
  return (
    <div className="space-y-6">
      <div className="flex justify-center py-1">
        <EntradaProgressDots total={progress.total} current={progress.current} />
      </div>
      <div key={step} className="animate-in fade-in-0 duration-300">
        {children}
      </div>
    </div>
  );
}
