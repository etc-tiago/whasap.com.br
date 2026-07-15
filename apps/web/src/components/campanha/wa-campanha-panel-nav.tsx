import { Link, useRouterState } from "@tanstack/react-router";
import { cn } from "@whasap/ui/lib/utils";
import { Bookmark, ExternalLink, History, Send } from "lucide-react";

import { CAMPANHA_ARTIGO_URL } from "@/lib/campanha";

const ITENS = [
  { rotulo: "Envio rápido", icone: Send, to: "/$organizacaoHash/campanha" as const, exact: true },
  {
    rotulo: "Histórico",
    icone: History,
    to: "/$organizacaoHash/campanha/historico" as const,
    exact: false,
  },
  {
    rotulo: "Templates salvos",
    icone: Bookmark,
    to: "/$organizacaoHash/campanha/templates" as const,
    exact: false,
  },
] as const;

type WaCampanhaPanelNavProps = {
  organizacaoHash: string;
};

/** Subnavegação da área Campanha. */
export function WaCampanhaPanelNav({ organizacaoHash }: WaCampanhaPanelNavProps) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  return (
    <section className="flex w-full shrink-0 flex-col border-r border-wa-divider bg-wa-panel md:w-72">
      <div className="px-5 pb-2 pt-4">
        <h1 className="text-2xl font-semibold text-wa-text">Campanha</h1>
        <a
          href={CAMPANHA_ARTIGO_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-1 inline-flex items-center gap-1 text-xs text-wa-text-muted hover:text-wa-green-dark"
        >
          Riscos e boas práticas
          <ExternalLink className="h-3 w-3" />
        </a>
      </div>
      <nav className="flex flex-col gap-0.5 px-2 pb-2">
        {ITENS.map(({ rotulo, icone: Icone, to, exact }) => {
          const ativo = exact
            ? pathname.endsWith("/campanha") || pathname.endsWith("/campanha/")
            : pathname.includes(to.split("/").pop()!);
          return (
            <Link
              key={to}
              to={to}
              params={{ organizacaoHash }}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                ativo
                  ? "bg-wa-chip-active text-wa-green-dark"
                  : "text-wa-text hover:bg-wa-hover",
              )}
            >
              <Icone className="h-5 w-5 shrink-0 text-wa-icon" />
              {rotulo}
            </Link>
          );
        })}
      </nav>
    </section>
  );
}
