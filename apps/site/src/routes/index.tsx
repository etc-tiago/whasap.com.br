import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@whasap/ui/components/button";
import {
  ArrowRight,
  Cloud,
  MessageCircle,
  MessagesSquare,
  Smartphone,
  Users,
} from "lucide-react";

import { PANEL_URL } from "@/lib/panel-url";
import { seo } from "@/lib/seo";

const description =
  "Whasap é a versão simplificada do WhatsApp para equipes. Conecte o WhatsApp Comercial e a Cloud API — ou ambos — e gerencie todos os chats em um só lugar.";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: seo({
      title: "Whasap — WhatsApp simplificado para equipes",
      description,
      path: "/",
    }),
    links: [{ rel: "canonical", href: "https://whasap.com.br/" }],
  }),
  component: LandingPage,
});

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
      "Distribua atendimentos, acompanhe conversas e otimize o trabalho do time de chat em um só painel.",
    icon: Users,
  },
];

const benefits = [
  {
    title: "Inbox unificado",
    description: "WhatsApp Comercial e Cloud API no mesmo lugar, com interface familiar e objetiva.",
    icon: MessageCircle,
  },
  {
    title: "Múltiplos canais",
    description: "Use um ou dois tipos de integração conforme a necessidade do seu negócio.",
    icon: Cloud,
  },
  {
    title: "Feito para equipes",
    description: "Organize atendimentos, reduza retrabalho e acelere respostas ao cliente.",
    icon: Users,
  },
];

function LandingPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border/60 bg-background/80 backdrop-blur-sm">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <Link to="/" className="flex items-center gap-2 text-lg font-semibold text-foreground">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-wa-green text-white">
              <MessageCircle className="h-5 w-5 fill-white" />
            </span>
            Whasap
          </Link>
          <nav className="hidden items-center gap-6 text-sm text-muted-foreground md:flex">
            <a href="#como-funciona" className="transition-colors hover:text-foreground">
              Como funciona
            </a>
            <a href="#beneficios" className="transition-colors hover:text-foreground">
              Benefícios
            </a>
          </nav>
          <Button asChild>
            <a href={PANEL_URL}>
              Começar agora
              <ArrowRight />
            </a>
          </Button>
        </div>
      </header>

      <main>
        <section className="relative overflow-hidden border-b border-border/60">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,oklch(0.92_0.08_155),transparent_60%)]" />
          <div className="relative mx-auto max-w-6xl px-6 py-20 md:py-28">
            <div className="max-w-3xl">
              <p className="mb-4 inline-flex items-center rounded-full border border-wa-green/20 bg-wa-green/10 px-3 py-1 text-sm font-medium text-wa-green-dark">
                WhatsApp simplificado para equipes
              </p>
              <h1 className="text-4xl font-bold tracking-tight text-foreground md:text-6xl">
                O Whasap conecta seus canais e centraliza o atendimento
              </h1>
              <p className="mt-6 text-lg leading-relaxed text-muted-foreground md:text-xl">
                {description}
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <Button asChild size="lg" className="bg-wa-green text-white hover:bg-wa-green-dark">
                  <a href={PANEL_URL}>
                    Começar agora
                    <ArrowRight />
                  </a>
                </Button>
                <Button asChild size="lg" variant="outline">
                  <a href="#como-funciona">Ver como funciona</a>
                </Button>
              </div>
            </div>
          </div>
        </section>

        <section className="border-b border-border/60 py-20" id="proposta">
          <div className="mx-auto max-w-6xl px-6">
            <div className="max-w-2xl">
              <h2 className="text-3xl font-bold tracking-tight md:text-4xl">
                Uma versão simplificada do WhatsApp, feita para operação
              </h2>
              <p className="mt-4 text-lg text-muted-foreground">
                O Whasap foi pensado para quem precisa unificar atendimento: conecte o WhatsApp
                Comercial, a Cloud API ou ambos juntos e tenha uma experiência mais leve para
                gerenciar equipes de chat.
              </p>
            </div>
            <div className="mt-10 grid gap-4 md:grid-cols-3">
              {["WhatsApp Comercial", "Cloud API", "Comercial + Cloud API"].map((item) => (
                <div
                  key={item}
                  className="rounded-2xl border border-border bg-card p-6 shadow-sm"
                >
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
              Três passos para sair da fragmentação e colocar sua equipe no mesmo fluxo de
              atendimento.
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

        <section className="py-20" id="beneficios">
          <div className="mx-auto max-w-6xl px-6">
            <h2 className="text-3xl font-bold tracking-tight md:text-4xl">Benefícios para sua equipe</h2>
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

        <section className="border-t border-border/60 bg-[oklch(0.97_0.03_155)] py-20">
          <div className="mx-auto flex max-w-6xl flex-col items-start justify-between gap-6 px-6 md:flex-row md:items-center">
            <div className="max-w-2xl">
              <h2 className="text-3xl font-bold tracking-tight md:text-4xl">
                Pronto para simplificar seu atendimento?
              </h2>
              <p className="mt-4 text-lg text-muted-foreground">
                Experimente o Whasap e veja como é gerenciar WhatsApp Comercial e Cloud API em um
                só lugar.
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

      <footer className="border-t border-border/60 py-8">
        <div className="mx-auto flex max-w-6xl flex-col gap-2 px-6 text-sm text-muted-foreground md:flex-row md:items-center md:justify-between">
          <p>© {new Date().getFullYear()} Whasap. Todos os direitos reservados.</p>
          <p>whasap.com.br — WhatsApp simplificado para equipes.</p>
        </div>
      </footer>
    </div>
  );
}
