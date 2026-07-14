import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect } from "react";
import { mvpDefaults } from "@whasap/config";
import { Button } from "@whasap/ui/components/button";
import { ArrowRight, Gift, Users } from "lucide-react";

import { SiteFooter, SiteHeader } from "@/components/site-chrome";
import { VENDAS_WHATSAPP } from "@/lib/contato-vendas";
import { PANEL_URL } from "@/lib/panel-url";
import { salvarRefIndicacao } from "@/lib/ref-indicacao";
import { seo } from "@/lib/seo";

const { billing } = mvpDefaults;
const { referral } = billing;

const description = `Indique o Whasap e ganhe ${referral.indicadorMesGratis} mês grátis. Seu indicado ganha ${referral.indicadoDescontoPercent}% no primeiro mês. Ideal para contadores e seus clientes.`;

export const Route = createFileRoute("/indique")({
  validateSearch: (search: Record<string, unknown>): { ref?: string } => {
    if (typeof search.ref === "string" && search.ref.length > 0) {
      return { ref: search.ref };
    }
    return {};
  },
  head: () => ({
    meta: seo({
      title: "Indique e Ganhe",
      description,
      path: "/indique",
    }),
    links: [{ rel: "canonical", href: "https://whasap.com.br/indique" }],
  }),
  component: IndiquePage,
});

function IndiquePage() {
  const { ref } = Route.useSearch();

  useEffect(() => {
    salvarRefIndicacao(ref);
  }, [ref]);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <SiteHeader highlight="indique" />

      <main>
        <section className="relative overflow-hidden border-b border-border/60">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,oklch(0.92_0.08_155),transparent_60%)]" />
          <div className="relative mx-auto max-w-6xl px-6 py-16 md:py-24">
            <div className="max-w-2xl">
              <p className="mb-4 inline-flex items-center rounded-full border border-wa-green/20 bg-wa-green/10 px-3 py-1 text-sm font-medium text-wa-green-dark">
                Programa Indique e Ganhe
              </p>
              <h1 className="text-4xl font-bold tracking-tight md:text-5xl">
                Indique o Whasap e ganhe {referral.indicadorMesGratis} mês grátis
              </h1>
              <p className="mt-6 text-lg leading-relaxed text-muted-foreground">
                Contadores: indique para colegas ou para seus clientes com equipe de atendimento.
                Quem você indica ganha {referral.indicadoDescontoPercent}% no primeiro mês.
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <Button asChild size="lg" className="bg-wa-green text-white hover:bg-wa-green-dark">
                  <a href={PANEL_URL}>
                    Criar conta e gerar meu link
                    <ArrowRight />
                  </a>
                </Button>
                <Button asChild size="lg" variant="outline">
                  <Link to="/precos">Ver planos</Link>
                </Button>
              </div>
            </div>
          </div>
        </section>

        <section className="border-b border-border/60 py-16">
          <div className="mx-auto grid max-w-6xl gap-6 px-6 md:grid-cols-2">
            <article className="rounded-2xl border border-wa-green/30 bg-wa-green/5 p-8">
              <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-wa-green/20 text-wa-green-dark">
                <Gift className="h-5 w-5" />
              </div>
              <h2 className="text-2xl font-semibold">Para quem indica</h2>
              <p className="mt-3 text-muted-foreground">
                Você ganha {referral.indicadorMesGratis} mês grátis (ou crédito equivalente) quando
                o indicado assinar e ativar o uso. Recompensa aplicada manualmente pela equipe
                comercial.
              </p>
            </article>
            <article className="rounded-2xl border border-border bg-card p-8 shadow-sm">
              <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-wa-green/15 text-wa-green-dark">
                <Users className="h-5 w-5" />
              </div>
              <h2 className="text-2xl font-semibold">Para quem foi indicado</h2>
              <p className="mt-3 text-muted-foreground">
                {referral.indicadoDescontoPercent}% de desconto no primeiro mês do plano escolhido.
                Teste de {billing.billingAfterUsageDays} dias com uso em paralelo incluído.
              </p>
            </article>
          </div>
        </section>

        <section className="bg-[oklch(0.97_0.03_155)] py-16">
          <div className="mx-auto flex max-w-6xl flex-col items-start justify-between gap-6 px-6 md:flex-row md:items-center">
            <div className="max-w-xl">
              <h2 className="text-2xl font-bold tracking-tight md:text-3xl">
                Já é cliente? Gere o link no painel
              </h2>
              <p className="mt-3 text-muted-foreground">
                Em Ajustes → Organização, use &quot;Gerar link de indicação&quot; e compartilhe com
                colegas ou clientes.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Button asChild className="bg-wa-green text-white hover:bg-wa-green-dark">
                <a href={PANEL_URL}>Abrir painel</a>
              </Button>
              {VENDAS_WHATSAPP ? (
                <Button asChild variant="outline">
                  <a
                    href={`https://wa.me/${VENDAS_WHATSAPP.replace(/\D/g, "")}?text=${encodeURIComponent("Olá! Quero saber mais sobre o Indique e Ganhe.")}`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Falar com vendas
                  </a>
                </Button>
              ) : null}
            </div>
          </div>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}
