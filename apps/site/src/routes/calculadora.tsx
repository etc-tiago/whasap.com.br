import { createFileRoute, Link } from "@tanstack/react-router";
import { mvpDefaults } from "@whasap/config";
import { Button } from "@whasap/ui/components/button";
import { ArrowRight } from "lucide-react";

import { CalculadoraInvestimento } from "@/components/calculadora-investimento";
import { SiteFooter, SiteHeader } from "@/components/site-chrome";
import { PANEL_URL } from "@/lib/panel-url";
import { seo } from "@/lib/seo";

const { billing } = mvpDefaults;

const description =
  "Compare o Whasap com plataformas por usuário e por conversa. Atendentes ilimitados e cobrança por contato único — veja quanto sua equipe economiza.";

export const Route = createFileRoute("/calculadora")({
  head: () => ({
    meta: seo({
      title: "Calculadora de economia",
      description,
      path: "/calculadora",
    }),
    links: [{ rel: "canonical", href: "https://whasap.com.br/calculadora" }],
  }),
  component: CalculadoraPage,
});

function CalculadoraPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <SiteHeader highlight="calculadora" />

      <main>
        <section className="border-b border-border/60">
          <div className="mx-auto grid max-w-6xl gap-12 px-6 py-16 md:py-20 lg:grid-cols-2 lg:items-start">
            <div>
              <p className="mb-4 text-sm font-medium text-wa-green-dark">Calculadora de economia</p>
              <h1 className="text-4xl font-bold tracking-tight md:text-5xl">
                Quanto você economiza com contato único e atendentes ilimitados?
              </h1>
              <p className="mt-6 text-lg leading-relaxed text-muted-foreground">
                Informe números, equipe e contatos únicos. Comparamos o Whasap com estimativas de
                mercado — plataforma por usuário e plataforma por conversa — sem citar marcas. Teste
                de {billing.billingAfterUsageDays} dias em paralelo.
              </p>
              <ul className="mt-6 space-y-2 text-sm text-muted-foreground">
                <li>· Atendentes ilimitados — sem R$50–90 por usuário</li>
                <li>· Contato único — cliente que fala várias vezes no mês conta 1×</li>
                <li>· Uso em paralelo — sem desconectar a ferramenta atual</li>
              </ul>
              <div className="mt-8 flex flex-wrap gap-3">
                <Button asChild size="lg" className="bg-wa-green text-white hover:bg-wa-green-dark">
                  <a href={PANEL_URL}>
                    Começar teste
                    <ArrowRight />
                  </a>
                </Button>
                <Button asChild size="lg" variant="outline">
                  <Link to="/contadores">Sou contabilidade</Link>
                </Button>
              </div>
            </div>

            <CalculadoraInvestimento
              mostrarTabela={false}
              modoComparacao
              defaults={{ numerosWhatsapp: 1, atendentes: 4, contatosUnicos: 1000 }}
            />
          </div>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}
