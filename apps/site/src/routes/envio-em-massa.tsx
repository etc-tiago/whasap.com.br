import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, MessageCircle } from "lucide-react";

import { seo } from "@/lib/seo";

export const Route = createFileRoute("/envio-em-massa")({
  head: () => ({
    meta: seo({
      title: "Envio em massa no WhatsApp: riscos e boas práticas",
      description:
        "Entenda os riscos de bloqueio ao enviar mensagens em massa no WhatsApp Comercial, números seguros e boas práticas.",
      path: "/envio-em-massa",
    }),
    links: [{ rel: "canonical", href: "https://whasap.com.br/envio-em-massa" }],
  }),
  component: EnvioEmMassaPage,
});

function EnvioEmMassaPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border/60">
        <div className="mx-auto flex max-w-3xl items-center gap-4 px-6 py-4">
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

      <main className="mx-auto max-w-3xl px-6 py-12">
        <h1 className="text-3xl font-bold tracking-tight">
          Envio em massa no WhatsApp: riscos e boas práticas
        </h1>
        <p className="mt-4 text-muted-foreground">
          O módulo de campanha do Whasap permite disparos manuais e rápidos. Use com
          responsabilidade — principalmente no WhatsApp Comercial (business), onde o volume
          agressivo eleva o risco de restrição ou bloqueio do número pela Meta/WhatsApp.
        </p>

        <section className="mt-12 scroll-mt-8 space-y-4 text-sm leading-relaxed text-muted-foreground">
          <h2 className="text-2xl font-semibold text-foreground">Riscos de bloqueio</h2>
          <p>
            Contas no WhatsApp Comercial (business) não são canais oficiais de API. Disparos
            repetidos, listas frias, mensagens sem contexto ou bursts em poucos minutos são sinais
            típicos de spam e podem resultar em alerta, limitação temporária ou banimento do número.
          </p>
          <p>
            O Whasap alerta e permite configurar limites por organização, mas a responsabilidade
            final sobre o uso do número é da sua operação.
          </p>
        </section>

        <section className="mt-12 scroll-mt-8 space-y-4 text-sm leading-relaxed text-muted-foreground">
          <h2 className="text-2xl font-semibold text-foreground">Números mais seguros</h2>
          <ul className="list-disc space-y-2 pl-5">
            <li>Prefira números aquecidos, com histórico real de conversas bidirecionais.</li>
            <li>Evite números recém-criados ou recém-trocados de aparelho para campanhas.</li>
            <li>
              Separe, quando possível, o número de atendimento do número usado para prospecção.
            </li>
            <li>
              Para volumes maiores e recorrentes, avalie a WhatsApp Cloud API (templates aprovados e
              políticas oficiais).
            </li>
          </ul>
        </section>

        <section className="mt-12 scroll-mt-8 space-y-4 text-sm leading-relaxed text-muted-foreground">
          <h2 className="text-2xl font-semibold text-foreground">Boas práticas</h2>
          <ul className="list-disc space-y-2 pl-5">
            <li>Envie apenas para contatos que autorizaram ou com quem já há relação comercial.</li>
            <li>Espaçe os disparos; evite dezenas de mensagens em poucos minutos.</li>
            <li>Personalize o texto; mensagens idênticas em massa aumentam o risco.</li>
            <li>
              Respeite horários comerciais e pause se o número apresentar falhas ou denúncias.
            </li>
            <li>
              Configure no Whasap limites por minuto/hora e o alerta de envios consecutivos
              compatíveis com o seu volume seguro.
            </li>
          </ul>
        </section>

        <section className="mt-12 scroll-mt-8 space-y-4 text-sm leading-relaxed text-muted-foreground">
          <h2 className="text-2xl font-semibold text-foreground">WhatsApp Cloud API</h2>
          <p>
            Na Cloud API, o envio fora da janela de 24h exige templates aprovados pela Meta, com
            variáveis bem preenchidas. Isso não elimina a necessidade de consentimento e boa
            prática, mas segue o caminho oficial de mensageria comercial em escala.
          </p>
        </section>

        <p className="mt-12 text-sm text-muted-foreground">
          Dúvidas sobre o plano ou a operação?{" "}
          <Link to="/precos" className="font-medium text-foreground underline underline-offset-2">
            Veja os planos
          </Link>{" "}
          ou fale com o time Whasap.
        </p>
      </main>
    </div>
  );
}
