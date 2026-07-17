import { createFileRoute, Link } from "@tanstack/react-router";
import { mvpDefaults } from "@whasap/config";
import { Button } from "@whasap/ui/components/button";
import { ArrowRight, BadgeCheck, Calculator, RefreshCw, Users } from "lucide-react";

import { CalculadoraInvestimento } from "@/components/calculadora-investimento";
import { SiteFooter, SiteHeader } from "@/components/site-chrome";
import { formatarPrecoBrl } from "@/lib/orcamento";
import { PANEL_URL } from "@/lib/panel-url";
import { seo } from "@/lib/seo";

const { billing } = mvpDefaults;
const starter = billing.plans[0];
const profissional = billing.plans.find((p) => p.id === "profissional")!;

const description =
  "Para contabilidades com 4+ atendentes: cobrança por contato único, atendentes ilimitados e teste em paralelo sem desconectar sua plataforma. Simule a economia.";

export const Route = createFileRoute("/contadores")({
  head: () => ({
    meta: seo({
      title: "Whasap para contabilidades — fundadores",
      description,
      path: "/contadores",
    }),
    links: [{ rel: "canonical", href: "https://whasap.com.br/contadores" }],
  }),
  component: ContadoresPage,
});

const pilares = [
  {
    title: "Teste em paralelo",
    description: `Risco zero: ${billing.billingAfterUsageDays} dias conectado junto da plataforma atual — sem desconectar o que já funciona.`,
    icon: RefreshCw,
  },
  {
    title: "Atendentes ilimitados",
    description:
      "Escritório com 6, 10 ou 15 atendentes? Na concorrência você paga por usuário. Aqui o time inteiro entra sem custo extra — economia típica de centenas por mês.",
    icon: Users,
  },
  {
    title: "Cobrança por contato único",
    description:
      "Cliente que fala 15 ou 20× no mês conta 1×. Em modelos por conversa ou janela, cada interação pode gerar nova cobrança.",
    icon: BadgeCheck,
  },
];

function ContadoresPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <SiteHeader highlight="contadores" />

      <main>
        <section className="relative overflow-hidden border-b border-border/60">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,oklch(0.92_0.08_155),transparent_60%)]" />
          <div className="relative mx-auto max-w-6xl px-6 py-16 md:py-24">
            <div className="grid items-start gap-12 lg:grid-cols-2 lg:gap-16">
              <div>
                <p className="mb-4 inline-flex items-center rounded-full border border-wa-green/20 bg-wa-green/10 px-3 py-1 text-sm font-medium text-wa-green-dark">
                  Campanha fundadores · contabilidades
                </p>
                <h1 className="text-4xl font-bold tracking-tight md:text-5xl">
                  Troque a plataforma cara por contato único e atendentes ilimitados
                </h1>
                <p className="mt-6 text-lg leading-relaxed text-muted-foreground">
                  Para contabilidades com 4+ atendentes: teste {billing.billingAfterUsageDays} dias
                  em paralelo sem desconectar nada. Depois, a partir de{" "}
                  {formatarPrecoBrl(starter.priceCents)}/mês — sugerimos {profissional.nome} (
                  {formatarPrecoBrl(profissional.priceCents)}) para escritórios em crescimento. Você
                  customiza números, equipe e contatos no simulador.
                </p>
                <div className="mt-8 flex flex-wrap gap-3">
                  <Button
                    asChild
                    size="lg"
                    className="bg-wa-green text-white hover:bg-wa-green-dark"
                  >
                    <a href={PANEL_URL}>
                      Começar teste de {billing.billingAfterUsageDays} dias
                      <ArrowRight />
                    </a>
                  </Button>
                  <Button asChild size="lg" variant="outline">
                    <Link to="/calculadora">Comparar economia</Link>
                  </Button>
                </div>
              </div>

              <CalculadoraInvestimento
                mostrarTabela={false}
                modoComparacao
                autoCalcular
                planoSugeridoId="profissional"
                defaults={{ numerosWhatsapp: 1, atendentes: 6, contatosUnicos: 800 }}
              />
            </div>
          </div>
        </section>

        <section className="border-b border-border/60 py-16">
          <div className="mx-auto max-w-6xl px-6">
            <div className="max-w-2xl">
              <h2 className="text-3xl font-bold tracking-tight md:text-4xl">
                Por que contabilidades escolhem o Whasap
              </h2>
              <p className="mt-4 text-lg text-muted-foreground">
                Os três diferenciais que matam a objeção de migrar — e a fatura por usuário.
              </p>
            </div>
            <div className="mt-10 grid gap-6 md:grid-cols-3">
              {pilares.map((item) => (
                <article
                  key={item.title}
                  className="rounded-2xl border border-border bg-card p-6 shadow-sm"
                >
                  <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-wa-green/15 text-wa-green-dark">
                    <item.icon className="h-5 w-5" />
                  </div>
                  <h3 className="text-xl font-semibold">{item.title}</h3>
                  <p className="mt-3 text-muted-foreground">{item.description}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="bg-[oklch(0.97_0.03_155)] py-16">
          <div className="mx-auto flex max-w-6xl flex-col items-start justify-between gap-6 px-6 md:flex-row md:items-center">
            <div className="max-w-2xl">
              <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-wa-green/20 text-wa-green-dark">
                <Calculator className="h-5 w-5" />
              </div>
              <h2 className="text-3xl font-bold tracking-tight md:text-4xl">
                Simulador já preenchido para o escritório típico
              </h2>
              <p className="mt-4 text-lg text-muted-foreground">
                1 número · 6 atendentes · 800 contatos únicos. Ajuste para a sua operação e veja a
                economia versus plataformas por usuário ou por conversa.
              </p>
            </div>
            <Button asChild size="lg" className="bg-wa-green text-white hover:bg-wa-green-dark">
              <a href={PANEL_URL}>
                Liberar teste
                <ArrowRight />
              </a>
            </Button>
          </div>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}
