import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@whasap/ui/components/button";
import { ArrowLeft, ArrowRight, MessageCircle } from "lucide-react";

import { SiteFooter } from "@/components/site-chrome";
import { PANEL_URL } from "@/lib/panel-url";
import { seo } from "@/lib/seo";

const description =
  "Assista à gravação do webinar Whasap de 02/07/2026 — WhatsApp para equipes, cobrança por contato único e uso em paralelo.";

export const Route = createFileRoute("/webinars/02-07-2026")({
  head: () => ({
    meta: seo({
      title: "Webinar Whasap — 02/07/2026",
      description,
      path: "/webinars/02-07-2026",
    }),
    links: [{ rel: "canonical", href: "https://whasap.com.br/webinars/02-07-2026" }],
  }),
  component: Webinar02072026Page,
});

function Webinar02072026Page() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border/60">
        <div className="mx-auto flex max-w-4xl items-center gap-4 px-6 py-4">
          <Link
            to="/"
            className="inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
            Voltar
          </Link>
          <Link to="/" className="ml-auto flex items-center gap-2 text-sm font-semibold">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-wa-green text-white">
              <MessageCircle className="h-4 w-4 fill-white" />
            </span>
            Whasap
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-6 py-12">
        <p className="mb-3 text-sm font-medium text-wa-green-dark">Webinar · 02/07/2026</p>
        <h1 className="text-3xl font-bold tracking-tight md:text-4xl">
          Gravação do webinar Whasap
        </h1>
        <p className="mt-4 max-w-2xl text-muted-foreground">
          Confira a apresentação completa sobre WhatsApp para equipes, cobrança por contato único e
          como testar o Whasap em paralelo com a sua operação atual.
        </p>

        <div
          className="relative mt-10 overflow-hidden rounded-2xl border border-border bg-card shadow-sm"
          style={{ paddingBottom: "57.50798722044729%", height: 0 }}
        >
          <iframe
            src="https://www.loom.com/embed/9e9aad1740934fbfb0eb4bdb6d6066bd"
            title="Webinar Whasap — 02/07/2026"
            allowFullScreen
            sandbox="allow-scripts allow-popups allow-forms"
            className="absolute inset-0 h-full w-full border-0"
          />
        </div>

        <div className="mt-10 flex flex-wrap gap-3">
          <Button asChild size="lg" className="bg-wa-green text-white hover:bg-wa-green-dark">
            <a href={PANEL_URL}>
              Começar teste grátis
              <ArrowRight />
            </a>
          </Button>
          <Button asChild size="lg" variant="outline">
            <Link to="/precos">Ver preços</Link>
          </Button>
        </div>
      </main>

      <SiteFooter />
    </div>
  );
}
