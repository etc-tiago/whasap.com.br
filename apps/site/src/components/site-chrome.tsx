import { Link } from "@tanstack/react-router";
import { Button } from "@whasap/ui/components/button";
import { ArrowRight } from "lucide-react";

import { LogoWhasap } from "@/components/logo-whasap";
import { PANEL_URL } from "@/lib/panel-url";

const navLinks = [
  { to: "/contadores" as const, label: "Contadores" },
  { to: "/calculadora" as const, label: "Calculadora" },
  { to: "/precos" as const, label: "Preços" },
  { to: "/" as const, hash: "diferenciais", label: "Diferenciais" },
  { to: "/indique" as const, label: "Indique e Ganhe" },
];

type NavHighlight = "precos" | "indique" | "contadores" | "calculadora";

/** Cabeçalho compartilhado das páginas de marketing. */
export function SiteHeader({ highlight }: { highlight?: NavHighlight }) {
  return (
    <header className="border-b border-border/60 bg-background/80 backdrop-blur-sm">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
        <Link to="/" className="flex items-center gap-2 text-lg font-semibold text-foreground">
          <LogoWhasap variante="verde" className="h-9" decorative />
          Whasap
        </Link>
        <nav className="hidden items-center gap-6 text-sm text-muted-foreground lg:flex">
          {navLinks.map((link) => {
            const ativo =
              (highlight === "precos" && link.to === "/precos") ||
              (highlight === "indique" && link.to === "/indique") ||
              (highlight === "contadores" && link.to === "/contadores") ||
              (highlight === "calculadora" && link.to === "/calculadora");
            return (
              <Link
                key={link.label}
                to={link.to}
                hash={link.hash}
                className={
                  ativo ? "font-medium text-foreground" : "transition-colors hover:text-foreground"
                }
              >
                {link.label}
              </Link>
            );
          })}
        </nav>
        <Button asChild>
          <a href={PANEL_URL}>
            Começar agora
            <ArrowRight />
          </a>
        </Button>
      </div>
    </header>
  );
}

/** Rodapé compartilhado. */
export function SiteFooter() {
  return (
    <footer className="border-t border-border/60 py-8">
      <div className="mx-auto flex max-w-6xl flex-col gap-2 px-6 text-sm text-muted-foreground md:flex-row md:items-center md:justify-between">
        <p className="flex items-center gap-2">
          <LogoWhasap variante="verde" className="h-5" decorative />
          <span>© {new Date().getFullYear()} Whasap. Todos os direitos reservados.</span>
        </p>
        <div className="flex flex-wrap gap-4">
          <Link to="/contadores" className="hover:text-foreground">
            Contadores
          </Link>
          <Link to="/calculadora" className="hover:text-foreground">
            Calculadora
          </Link>
          <Link to="/precos" className="hover:text-foreground">
            Preços
          </Link>
          <Link to="/indique" className="hover:text-foreground">
            Indique e Ganhe
          </Link>
          <Link to="/webinars/02-07-2026" className="hover:text-foreground">
            Webinar
          </Link>
          <Link to="/legal" className="hover:text-foreground">
            Termos
          </Link>
        </div>
      </div>
    </footer>
  );
}
