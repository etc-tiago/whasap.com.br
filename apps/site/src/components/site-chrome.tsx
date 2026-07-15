import { Link } from "@tanstack/react-router";
import { Button } from "@whasap/ui/components/button";
import { ArrowRight, MessageCircle } from "lucide-react";

import { PANEL_URL } from "@/lib/panel-url";

const navLinks = [
  { to: "/precos" as const, label: "Preços" },
  { to: "/" as const, hash: "diferenciais", label: "Diferenciais" },
  { to: "/indique" as const, label: "Indique e Ganhe" },
];

/** Cabeçalho compartilhado das páginas de marketing. */
export function SiteHeader({ highlight }: { highlight?: "precos" | "indique" }) {
  return (
    <header className="border-b border-border/60 bg-background/80 backdrop-blur-sm">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
        <Link to="/" className="flex items-center gap-2 text-lg font-semibold text-foreground">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-wa-green text-white">
            <MessageCircle className="h-5 w-5 fill-white" />
          </span>
          Whasap
        </Link>
        <nav className="hidden items-center gap-6 text-sm text-muted-foreground md:flex">
          {navLinks.map((link) => {
            const ativo =
              (highlight === "precos" && link.to === "/precos") ||
              (highlight === "indique" && link.to === "/indique");
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
        <p>© {new Date().getFullYear()} Whasap. Todos os direitos reservados.</p>
        <div className="flex flex-wrap gap-4">
          <Link to="/precos" className="hover:text-foreground">
            Preços
          </Link>
          <Link to="/indique" className="hover:text-foreground">
            Indique e Ganhe
          </Link>
          <Link to="/legal" className="hover:text-foreground">
            Termos
          </Link>
        </div>
      </div>
    </footer>
  );
}
