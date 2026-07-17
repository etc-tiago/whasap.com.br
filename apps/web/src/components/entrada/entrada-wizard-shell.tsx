import type { ReactNode } from "react";

import { LogoWhasap } from "@/components/logo-whasap";

import { EntradaProgressDots } from "./entrada-progress-dots";

type Props = {
  step: string;
  progress: { current: number; total: number };
  children: ReactNode;
};

export function EntradaWizardShell({ step, progress, children }: Props) {
  return (
    <div className="relative flex min-h-screen items-center justify-center px-4 py-10">
      <div className="w-full max-w-[440px] overflow-hidden rounded-2xl border border-wa-border bg-wa-surface shadow-[0_10px_40px_-15px_rgba(7,94,84,0.35)]">
        <header className="flex flex-col items-center gap-3 bg-linear-to-br from-wa-teal to-wa-green-dark px-6 pb-4 pt-6">
          <div className="flex items-center gap-2 text-white">
            <LogoWhasap variante="branco" className="h-8" decorative />
            <span className="text-base font-semibold tracking-tight">Whasap</span>
          </div>
          <EntradaProgressDots total={progress.total} current={progress.current} />
        </header>

        <div className="relative px-6 py-7">
          <div key={step} className="animate-in fade-in-0 slide-in-from-right-2 duration-300">
            {children}
          </div>
        </div>

        <footer className="flex flex-col items-center gap-2 border-t border-wa-border px-6 py-3 text-center text-[11px] text-wa-muted">
          <LogoWhasap variante="verde" className="h-5" />
          <p>Ao continuar, você concorda com nossos Termos e Política de Privacidade</p>
        </footer>
      </div>
    </div>
  );
}
