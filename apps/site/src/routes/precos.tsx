import { createFileRoute } from "@tanstack/react-router";
import { mvpDefaults } from "@whasap/config";
import { Button } from "@whasap/ui/components/button";
import { ArrowRight } from "lucide-react";

import { CalculadoraInvestimento, TabelaPrecosPlanos } from "@/components/calculadora-investimento";
import { SiteFooter, SiteHeader } from "@/components/site-chrome";
import { PANEL_URL } from "@/lib/panel-url";
import { formatarPrecoBrl } from "@/lib/orcamento";
import { seo } from "@/lib/seo";

const { billing } = mvpDefaults;

const description =
  "Planos Whasap por contato único: Starter, Profissional, Business e Enterprise. Cliente que conversa várias vezes no mês conta apenas 1×. Teste de 7 dias com uso em paralelo.";

export const Route = createFileRoute("/precos")({
  head: () => ({
    meta: seo({
      title: "Preços — planos por contato único",
      description,
      path: "/precos",
    }),
    links: [{ rel: "canonical", href: "https://whasap.com.br/precos" }],
  }),
  component: PrecosPage,
});

function PrecosPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <SiteHeader highlight="precos" />

      <main>
        <section className="border-b border-border/60">
          <div className="mx-auto max-w-6xl px-6 py-16 md:py-20">
            <div className="max-w-2xl">
              <p className="mb-4 text-sm font-medium text-wa-green-dark">Tabela de preços</p>
              <h1 className="text-4xl font-bold tracking-tight md:text-5xl">
                Planos claros, cobrança por contato único
              </h1>
              <p className="mt-6 text-lg leading-relaxed text-muted-foreground">
                Cobrança por contato único — cliente que conversa várias vezes no mês conta apenas
                1×. Sem custo por atendente. Teste de {billing.billingAfterUsageDays} dias com uso
                em paralelo.
              </p>
            </div>

            <div className="mt-12 overflow-x-auto rounded-2xl border border-border bg-card p-4 shadow-sm md:p-6">
              <TabelaPrecosPlanos compact={false} />
            </div>

            <div className="mt-8 grid gap-4 sm:grid-cols-3">
              <div className="rounded-2xl border border-border bg-card p-5">
                <p className="text-sm font-medium text-wa-green-dark">Contato único</p>
                <p className="mt-2 text-sm text-muted-foreground">
                  Quem interagiu no período conta uma vez — independente de volume de mensagens.
                </p>
              </div>
              <div className="rounded-2xl border border-border bg-card p-5">
                <p className="text-sm font-medium text-wa-green-dark">Conexão extra</p>
                <p className="mt-2 text-sm text-muted-foreground">
                  {formatarPrecoBrl(billing.extraConnectionPriceCents)}/mês por número além dos
                  inclusos no plano.
                </p>
              </div>
              <div className="rounded-2xl border border-border bg-card p-5">
                <p className="text-sm font-medium text-wa-green-dark">Pacote de 100</p>
                <p className="mt-2 text-sm text-muted-foreground">
                  Contatos acima do incluso: a partir de{" "}
                  {formatarPrecoBrl(billing.plans[0].extraContactsPackPriceCents)} (Enterprise:{" "}
                  {formatarPrecoBrl(billing.plans[3].extraContactsPackPriceCents)}).
                </p>
              </div>
            </div>
          </div>
        </section>

        <section className="border-b border-border/60 bg-muted/30 py-16" id="calculadora">
          <div className="mx-auto grid max-w-6xl gap-12 px-6 lg:grid-cols-2 lg:items-start">
            <div>
              <h2 className="text-3xl font-bold tracking-tight md:text-4xl">
                Calculadora interativa
              </h2>
              <p className="mt-4 text-lg text-muted-foreground">
                Informe quantos números e contatos únicos você espera por mês. Sugerimos o plano
                mais econômico automaticamente.
              </p>
              <Button
                asChild
                className="mt-8 bg-wa-green text-white hover:bg-wa-green-dark"
                size="lg"
              >
                <a href={PANEL_URL}>
                  Começar teste de {billing.billingAfterUsageDays} dias
                  <ArrowRight />
                </a>
              </Button>
            </div>
            <CalculadoraInvestimento mostrarTabela={false} />
          </div>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}
