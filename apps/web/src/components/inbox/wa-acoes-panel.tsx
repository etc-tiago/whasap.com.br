import { Link, useRouterState } from "@tanstack/react-router";
import { Clock, MessageSquare, Tag, Users } from "lucide-react";

import { cn } from "@whasap/ui/lib/utils";

const ITENS = [
  { rotulo: "Conversas", icone: MessageSquare, to: "/$organizacaoHash/acoes/conversas" as const },
  { rotulo: "Equipe", icone: Users, to: "/$organizacaoHash/acoes/equipe" as const },
  { rotulo: "Etiquetas", icone: Tag, to: "/$organizacaoHash/acoes/etiquetas" as const },
  { rotulo: "Automação", icone: Clock, to: "/$organizacaoHash/acoes/automacao" as const },
] as const;

type WaAcoesPanelProps = {
  organizacaoHash: string;
};

export function WaAcoesPanel({ organizacaoHash }: WaAcoesPanelProps) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const itemAtivo = ITENS.find((item) => pathname.includes(`/${item.to.split("/").pop()}`));

  return (
    <section className="flex w-full shrink-0 flex-col border-r border-wa-divider bg-wa-panel md:w-80">
      <div className="px-5 pb-2 pt-4">
        <h1 className="text-2xl font-semibold text-wa-text">Ações</h1>
      </div>
      <nav className="flex flex-col gap-0.5 px-2 pb-2">
        <Link
          to="/$organizacaoHash/acoes"
          params={{ organizacaoHash }}
          className={cn(
            "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
            !itemAtivo ? "bg-wa-chip-active text-wa-green-dark" : "text-wa-text hover:bg-wa-hover",
          )}
        >
          Visão geral
        </Link>
        {ITENS.map(({ rotulo, icone: Icone, to }) => (
          <Link
            key={to}
            to={to}
            params={{ organizacaoHash }}
            className={cn(
              "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
              itemAtivo?.to === to
                ? "bg-wa-chip-active text-wa-green-dark"
                : "text-wa-text hover:bg-wa-hover",
            )}
          >
            <Icone className="h-5 w-5 shrink-0 text-wa-icon" />
            {rotulo}
          </Link>
        ))}
      </nav>
    </section>
  );
}
