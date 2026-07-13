import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, MessageCircle } from "lucide-react";

import { seo } from "@/lib/seo";

export const Route = createFileRoute("/legal")({
  head: () => ({
    meta: seo({
      title: "Termos de Uso e Política de Privacidade",
      description: "Termos de Uso e Política de Privacidade do Whasap, em conformidade com a LGPD.",
      path: "/legal",
    }),
    links: [{ rel: "canonical", href: "https://whasap.com.br/legal" }],
  }),
  component: LegalPage,
});

function LegalPage() {
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
          Termos de Uso e Política de Privacidade
        </h1>
        <p className="mt-4 text-muted-foreground">
          Última atualização: julho de 2026. Ao criar uma conta no Whasap, você declara ter lido e
          aceito os documentos abaixo.
        </p>

        <section id="termos" className="mt-12 scroll-mt-8">
          <h2 className="text-2xl font-semibold">Termos de Uso</h2>
          <div className="mt-4 space-y-4 text-sm leading-relaxed text-muted-foreground">
            <p>
              O Whasap é uma plataforma de atendimento via WhatsApp para equipes. Ao utilizar o
              serviço, você concorda em usar a plataforma de forma lícita, respeitando a legislação
              aplicável, as políticas da Meta/WhatsApp e os direitos de terceiros.
            </p>
            <p>
              Você é responsável pelas mensagens enviadas pela sua organização, pelo cadastro de
              usuários autorizados e pela guarda de credenciais de acesso. O Whasap pode suspender
              ou encerrar contas em caso de uso abusivo, fraude, violação destes termos ou ordem
              legal.
            </p>
            <p>
              Planos, limites e preços podem ser alterados com aviso prévio. O serviço é oferecido
              &quot;como está&quot;, dentro dos limites permitidos pela lei, sem garantias
              implícitas de disponibilidade ininterrupta.
            </p>
          </div>
        </section>

        <section id="adesao" className="mt-12 scroll-mt-8">
          <h2 className="text-2xl font-semibold">Termo de adesão da conta</h2>
          <p className="mt-2 text-xs text-muted-foreground">Versão 2026-07</p>
          <div className="mt-4 space-y-4 text-sm leading-relaxed text-muted-foreground">
            <p>
              Ao criar uma organização no Whasap, você declara que os dados cadastrais informados
              (incluindo CNPJ, razão social e WhatsApp de contato) são verdadeiros e que está
              autorizado a representar a pessoa jurídica perante a plataforma.
            </p>
            <p>
              O acesso ao painel é liberado desde o início da adesão. Não há período grátis
              garantido nem trial de produto: o uso do serviço está sujeito à cobrança conforme
              este termo.
            </p>
            <p>
              Após mais de 3 (três) dias de uso da organização, será gerado boleto por uso, com
              rateio mensal manual com base no consumo do período (conexões, conversas e demais
              itens contratados). O não pagamento pode resultar em suspensão ou encerramento do
              acesso.
            </p>
            <p>
              Valores informativos no site (calculadora e páginas comerciais) não substituem o
              boleto emitido com base no uso efetivo. Alterações de preço ou política de cobrança
              serão comunicadas com aviso prévio razoável.
            </p>
            <p>
              O aceite deste termo é registrado no momento da criação da organização, com a versão
              vigente indicada acima.
            </p>
          </div>
        </section>

        <section id="privacidade" className="mt-12 scroll-mt-8">
          <h2 className="text-2xl font-semibold">Política de Privacidade (LGPD)</h2>
          <div className="mt-4 space-y-4 text-sm leading-relaxed text-muted-foreground">
            <p>
              Tratamos dados pessoais conforme a Lei Geral de Proteção de Dados (Lei nº
              13.709/2018). Coletamos informações necessárias para criar e administrar sua conta,
              autenticar acessos, operar o atendimento via WhatsApp e cumprir obrigações legais.
            </p>
            <p>
              Podemos processar nome, e-mail, dados de organização, registros de uso, metadados de
              mensagens e conteúdo necessário à prestação do serviço. Bases legais incluem execução
              de contrato, legítimo interesse e consentimento, quando aplicável.
            </p>
            <p>
              Não vendemos dados pessoais. Compartilhamos informações apenas com provedores
              essenciais à operação (hospedagem, e-mail transacional, integrações autorizadas) e
              quando exigido por lei. Adotamos medidas técnicas e organizacionais para proteger os
              dados.
            </p>
            <p>
              Você pode solicitar acesso, correção, portabilidade, anonimização, eliminação ou
              revogação de consentimento pelo canal de suporte indicado no painel. O encarregado de
              dados (DPO) pode ser contatado pelo mesmo canal.
            </p>
          </div>
        </section>
      </main>
    </div>
  );
}
