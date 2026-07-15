import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect } from "react";
import { Button } from "@whasap/ui/components/button";
import { mvpDefaults } from "@whasap/config";
import {
  ArrowRight,
  Building2,
  Cloud,
  GraduationCap,
  HardHat,
  Home,
  Hotel,
  MessageCircle,
  MessagesSquare,
  Package,
  PawPrint,
  Pill,
  Scale,
  Shield,
  ShoppingBag,
  Smartphone,
  Stethoscope,
  Truck,
  Users,
  UtensilsCrossed,
  Wrench,
  RefreshCw,
  Calculator,
  BadgeCheck,
} from "lucide-react";

import { CalculadoraInvestimento } from "@/components/calculadora-investimento";
import { SiteFooter, SiteHeader } from "@/components/site-chrome";
import { PANEL_URL } from "@/lib/panel-url";
import { salvarRefIndicacao } from "@/lib/ref-indicacao";
import { seo } from "@/lib/seo";

const { billing } = mvpDefaults;

const description =
  "Whasap é WhatsApp para equipes com cobrança por contato único. Ideal para contabilidades e operações com 4+ atendentes. Teste 7 dias com uso em paralelo — sem desconectar sua plataforma atual.";

export const Route = createFileRoute("/")({
  validateSearch: (search: Record<string, unknown>): { ref?: string } => {
    if (typeof search.ref === "string" && search.ref.length > 0) {
      return { ref: search.ref };
    }
    return {};
  },
  head: () => ({
    meta: seo({
      title: "Whasap — WhatsApp sem limites para equipes",
      description,
      path: "/",
    }),
    links: [{ rel: "canonical", href: "https://whasap.com.br/" }],
  }),
  component: LandingPage,
});

const segmentos = [
  {
    title: "Contabilidades",
    description:
      "Múltiplos clientes, documentos e prazos no mesmo inbox — sem perder mensagens entre números.",
    icon: Building2,
  },
  {
    title: "Farmácias",
    description:
      "Pedidos, receitas e status de entrega com vários atendentes ao mesmo tempo, no mesmo fluxo.",
    icon: Pill,
  },
  {
    title: "Distribuidoras",
    description: "Catálogo, cotações e pedidos B2B sem trocar de número ou alternar entre apps.",
    icon: Truck,
  },
  {
    title: "Clínicas e consultórios",
    description:
      "Confirmação de consultas, resultados e orientações com equipe de recepção e atendimento unificada.",
    icon: Stethoscope,
  },
  {
    title: "Imobiliárias",
    description:
      "Visitas, propostas e documentação de locação ou venda distribuídas entre corretores no mesmo número.",
    icon: Home,
  },
  {
    title: "E-commerce e varejo",
    description:
      "Rastreio de pedidos, trocas e pós-venda com vários atendentes sem fila única no celular.",
    icon: ShoppingBag,
  },
  {
    title: "Escritórios de advocacia",
    description:
      "Triagem de casos, envio de documentos e acompanhamento processual com sigilo e organização.",
    icon: Scale,
  },
  {
    title: "Escolas e cursos",
    description:
      "Matrículas, avisos aos responsáveis e suporte acadêmico com equipe de secretaria coordenada.",
    icon: GraduationCap,
  },
  {
    title: "Oficinas e auto centers",
    description:
      "Orçamentos, aprovação de serviços e aviso de veículo pronto com mecânicos e consultores alinhados.",
    icon: Wrench,
  },
  {
    title: "Restaurantes e delivery",
    description:
      "Pedidos, cardápio e status de entrega com cozinha e atendimento no mesmo fluxo de mensagens.",
    icon: UtensilsCrossed,
  },
  {
    title: "Hotéis e pousadas",
    description:
      "Reservas, check-in e solicitações de hóspedes atendidas pela recepção e concierge juntos.",
    icon: Hotel,
  },
  {
    title: "Seguradoras e corretoras",
    description:
      "Cotações, sinistros e renovações com corretores e suporte compartilhando o mesmo canal.",
    icon: Shield,
  },
  {
    title: "Clínicas veterinárias",
    description:
      "Agendamentos, receitas e acompanhamento de pets com equipe clínica e balcão sincronizados.",
    icon: PawPrint,
  },
  {
    title: "Construtoras",
    description:
      "Dúvidas de compradores, obra e documentação comercial com vários consultores no mesmo número.",
    icon: HardHat,
  },
  {
    title: "Logística e transporte",
    description:
      "Coletas, entregas e ocorrências em rota com despacho e motoristas no mesmo painel de atendimento.",
    icon: Package,
  },
  {
    title: "Equipe",
    description:
      "Qualquer operação com 4 ou mais atendentes — sem cobrança por usuário, com todo o time no mesmo painel.",
    icon: Users,
    destaque: true,
  },
];

const steps = [
  {
    title: "Conecte seus canais",
    description:
      "Integre o WhatsApp Comercial, a Cloud API da Meta ou os dois ao mesmo tempo em poucos passos.",
    icon: Smartphone,
  },
  {
    title: "Centralize conversas",
    description:
      "Todas as mensagens chegam em uma única caixa de entrada, sem alternar entre apps ou números.",
    icon: MessagesSquare,
  },
  {
    title: "Gerencie sua equipe",
    description:
      "Distribua atendimentos entre 4 ou mais atendentes simultâneos e acompanhe tudo em um só painel.",
    icon: Users,
  },
];

const diferenciais = [
  {
    title: "Uso em paralelo",
    description: `Teste ${billing.billingAfterUsageDays} dias sem risco: conecte o Whasap junto da plataforma atual — sem desconectar o que já funciona.`,
    icon: RefreshCw,
  },
  {
    title: "Cobrança por contato único",
    description:
      "Cliente que conversa várias vezes no mês conta apenas 1×. Diferente de modelos por mensagem ou janela (como Reportei, Como e Data Crazy).",
    icon: BadgeCheck,
  },
  {
    title: "Feito para equipes de contadores",
    description:
      "Nicho inicial: escritórios de contabilidade com alto volume de atendimento e vários atendentes — sem custo por usuário.",
    icon: Calculator,
  },
];

const benefits = [
  {
    title: "Inbox unificado",
    description:
      "WhatsApp Comercial e Cloud API no mesmo lugar, com interface familiar e objetiva.",
    icon: MessageCircle,
  },
  {
    title: "Múltiplos canais",
    description: "Use um ou dois tipos de integração conforme a necessidade do seu negócio.",
    icon: Cloud,
  },
  {
    title: "Atendentes ilimitados",
    description: "Organize quantos atendentes precisar — sem custo por usuário.",
    icon: Users,
  },
];

function LandingPage() {
  const { ref } = Route.useSearch();

  useEffect(() => {
    salvarRefIndicacao(ref);
  }, [ref]);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <SiteHeader />

      <main>
        <section className="relative overflow-hidden border-b border-border/60">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,oklch(0.92_0.08_155),transparent_60%)]" />
          <div className="relative mx-auto max-w-6xl px-6 py-20 md:py-28">
            <div className="grid items-start gap-12 lg:grid-cols-2 lg:gap-16">
              <div>
                <p className="mb-4 inline-flex items-center rounded-full border border-wa-green/20 bg-wa-green/10 px-3 py-1 text-sm font-medium text-wa-green-dark">
                  WhatsApp sem limites para equipes
                </p>
                <h1 className="text-4xl font-bold tracking-tight text-foreground md:text-5xl lg:text-6xl">
                  Atenda mais clientes com toda a equipe no mesmo lugar
                </h1>
                <p className="mt-6 text-lg leading-relaxed text-muted-foreground md:text-xl">
                  {description}
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
                    <Link to="/precos">Ver preços</Link>
                  </Button>
                </div>
              </div>
              <CalculadoraInvestimento />
            </div>
          </div>
        </section>

        <section className="border-b border-border/60 py-20" id="diferenciais">
          <div className="mx-auto max-w-6xl px-6">
            <div className="max-w-2xl">
              <h2 className="text-3xl font-bold tracking-tight md:text-4xl">Diferenciais</h2>
              <p className="mt-4 text-lg text-muted-foreground">
                O que muda na operação do dia a dia — e na fatura do mês.
              </p>
            </div>
            <div className="mt-12 grid gap-6 md:grid-cols-3">
              {diferenciais.map((item) => (
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

        <section className="border-b border-border/60 py-20" id="para-quem">
          <div className="mx-auto max-w-6xl px-6">
            <div className="max-w-2xl">
              <h2 className="text-3xl font-bold tracking-tight md:text-4xl">
                Para quem é o Whasap
              </h2>
              <p className="mt-4 text-lg text-muted-foreground">
                Pensado para operações com vários atendentes — de contabilidades a restaurantes,
                clínicas, e-commerce e muito mais. Escale o atendimento sem escalar a fatura por
                usuário.
              </p>
            </div>
            <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {segmentos.map((segmento) => (
                <article
                  key={segmento.title}
                  className={
                    segmento.destaque
                      ? "rounded-2xl border border-wa-green/30 bg-wa-green/5 p-6 shadow-sm sm:col-span-2 lg:col-span-4"
                      : "rounded-2xl border border-border bg-card p-6 shadow-sm"
                  }
                >
                  <div
                    className={
                      segmento.destaque
                        ? "mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-wa-green/20 text-wa-green-dark"
                        : "mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-wa-green/15 text-wa-green-dark"
                    }
                  >
                    <segmento.icon className="h-5 w-5" />
                  </div>
                  <h3 className="text-lg font-semibold">{segmento.title}</h3>
                  <p className="mt-2 text-sm text-muted-foreground">{segmento.description}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="border-b border-border/60 py-20" id="proposta">
          <div className="mx-auto max-w-6xl px-6">
            <div className="max-w-2xl">
              <h2 className="text-3xl font-bold tracking-tight md:text-4xl">
                WhatsApp simplificado para quem opera em escala
              </h2>
              <p className="mt-4 text-lg text-muted-foreground">
                O Whasap foi pensado para contabilidades, farmácias, distribuidoras e equipes com
                mais de 4 atendentes: conecte o WhatsApp Comercial, a Cloud API ou ambos juntos —
                sem limite de atendentes e com uma experiência leve para gerenciar o dia a dia.
              </p>
            </div>
            <div className="mt-10 grid gap-4 md:grid-cols-3">
              {["WhatsApp Comercial", "Cloud API", "Comercial + Cloud API"].map((item) => (
                <div key={item} className="rounded-2xl border border-border bg-card p-6 shadow-sm">
                  <p className="text-sm font-medium text-wa-green-dark">Integração</p>
                  <p className="mt-2 text-lg font-semibold">{item}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="border-b border-border/60 bg-muted/30 py-20" id="como-funciona">
          <div className="mx-auto max-w-6xl px-6">
            <h2 className="text-3xl font-bold tracking-tight md:text-4xl">Como funciona</h2>
            <p className="mt-4 max-w-2xl text-lg text-muted-foreground">
              Três passos para sair da fragmentação e colocar sua equipe — de 4 a dezenas de
              atendentes — no mesmo fluxo de atendimento.
            </p>
            <div className="mt-12 grid gap-6 md:grid-cols-3">
              {steps.map((step, index) => (
                <article
                  key={step.title}
                  className="rounded-2xl border border-border bg-background p-6 shadow-sm"
                >
                  <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-wa-green/15 text-wa-green-dark">
                    <step.icon className="h-5 w-5" />
                  </div>
                  <p className="text-sm font-medium text-muted-foreground">Passo {index + 1}</p>
                  <h3 className="mt-2 text-xl font-semibold">{step.title}</h3>
                  <p className="mt-3 text-muted-foreground">{step.description}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="border-b border-border/60 py-20" id="beneficios">
          <div className="mx-auto max-w-6xl px-6">
            <h2 className="text-3xl font-bold tracking-tight md:text-4xl">
              Benefícios para sua equipe
            </h2>
            <div className="mt-12 grid gap-6 md:grid-cols-3">
              {benefits.map((benefit) => (
                <article
                  key={benefit.title}
                  className="rounded-2xl border border-border bg-card p-6 shadow-sm"
                >
                  <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-wa-green/15 text-wa-green-dark">
                    <benefit.icon className="h-5 w-5" />
                  </div>
                  <h3 className="text-xl font-semibold">{benefit.title}</h3>
                  <p className="mt-3 text-muted-foreground">{benefit.description}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="border-b border-border/60 py-20" id="webinar">
          <div className="mx-auto flex max-w-6xl flex-col items-start justify-between gap-6 px-6 md:flex-row md:items-center">
            <div className="max-w-2xl">
              <p className="mb-3 text-sm font-medium text-wa-green-dark">Webinar · 02/07/2026</p>
              <h2 className="text-3xl font-bold tracking-tight md:text-4xl">
                Assista à gravação do webinar
              </h2>
              <p className="mt-4 text-lg text-muted-foreground">
                Conheça o Whasap em detalhes: WhatsApp para equipes, cobrança por contato único e
                como testar em paralelo sem desconectar sua operação atual.
              </p>
            </div>
            <Button asChild size="lg" variant="outline">
              <Link to="/webinars/02-07-2026">
                Ver gravação
                <ArrowRight />
              </Link>
            </Button>
          </div>
        </section>

        <section className="border-t border-border/60 bg-[oklch(0.97_0.03_155)] py-20">
          <div className="mx-auto flex max-w-6xl flex-col items-start justify-between gap-6 px-6 md:flex-row md:items-center">
            <div className="max-w-2xl">
              <h2 className="text-3xl font-bold tracking-tight md:text-4xl">
                Comece com {billing.billingAfterUsageDays} dias de teste
              </h2>
              <p className="mt-4 text-lg text-muted-foreground">
                Use em paralelo com sua plataforma atual. Depois do teste, emitimos boleto conforme
                o plano e o uso (contatos únicos e conexões).{" "}
                <Link
                  to="/precos"
                  className="font-medium text-wa-green-dark underline-offset-4 hover:underline"
                >
                  Ver tabela completa
                </Link>
                .
              </p>
            </div>
            <Button asChild size="lg" className="bg-wa-green text-white hover:bg-wa-green-dark">
              <a href={PANEL_URL}>
                Começar agora
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
