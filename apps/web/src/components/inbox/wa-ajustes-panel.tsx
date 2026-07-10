import { Link, useRouterState } from "@tanstack/react-router";
import { Plug, Tag, Users } from "lucide-react";

import { cn } from "@whasap/ui/lib/utils";

const ITENS = [
  { rotulo: "Usuários", icone: Users, to: "/$organizacaoHash/ajustes/usuarios" as const },
  { rotulo: "Etiquetas", icone: Tag, to: "/$organizacaoHash/ajustes/etiquetas" as const },
  { rotulo: "Conexão", icone: Plug, to: "/$organizacaoHash/ajustes/conexao" as const },
] as const;

type WaAjustesPanelProps = {
  organizacaoHash: string;
};

export function WaAjustesPanel({ organizacaoHash }: WaAjustesPanelProps) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const itemAtivo = ITENS.find((item) => pathname.includes(`/${item.to.split("/").pop()}`));

  return (
    <section className="flex w-full shrink-0 flex-col border-r border-wa-divider bg-wa-panel md:w-80">
      <div className="px-5 pb-2 pt-4">
        <h1 className="text-2xl font-semibold text-wa-text">Ajustes</h1>
      </div>
      <nav className="flex flex-col gap-0.5 px-2 pb-2">
        <Link
          to="/$organizacaoHash/ajustes"
          params={{ organizacaoHash }}
          className={cn(
            "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
            !itemAtivo ? "bg-wa-chip-active text-wa-green-dark" : "text-wa-text hover:bg-wa-hover",
          )}
        >
          Geral
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
