import { mvpDefaults } from "./mvp-defaults";

const { billing } = mvpDefaults;

export type PlanoBilling = (typeof billing.plans)[number];
export type PlanoBillingId = PlanoBilling["id"];

export interface InvestimentoMensalCalculado {
  plano: PlanoBilling;
  contatosUnicos: number;
  conexoes: number;
  contatosIncluidos: number;
  conexoesIncluidas: number;
  pacotesContatosExtras: number;
  conexoesExtras: number;
  precoPlanoCents: number;
  precoConexoesExtrasCents: number;
  precoContatosExtrasCents: number;
  totalCents: number;
}

/**
 * Calcula o investimento mensal estimado escolhendo o plano com menor total
 * (preço do plano + conexões extras + pacotes de 100 contatos únicos).
 */
export function calcularInvestimentoMensal(params: {
  contatosUnicos: number;
  conexoes: number;
}): InvestimentoMensalCalculado {
  const contatosUnicos = Math.max(0, Math.floor(params.contatosUnicos));
  const conexoes = Math.max(1, Math.floor(params.conexoes));
  const { extraConnectionPriceCents, contactsPerExtraPack, plans } = billing;

  let melhor: InvestimentoMensalCalculado | null = null;

  for (const plano of plans) {
    const conexoesExtras = Math.max(0, conexoes - plano.connectionsIncluded);
    const contatosExtras = Math.max(0, contatosUnicos - plano.contactsIncluded);
    const pacotesContatosExtras = Math.ceil(contatosExtras / contactsPerExtraPack);
    const precoConexoesExtrasCents = conexoesExtras * extraConnectionPriceCents;
    const precoContatosExtrasCents = pacotesContatosExtras * plano.extraContactsPackPriceCents;
    const totalCents = plano.priceCents + precoConexoesExtrasCents + precoContatosExtrasCents;

    const candidato: InvestimentoMensalCalculado = {
      plano,
      contatosUnicos,
      conexoes,
      contatosIncluidos: plano.contactsIncluded,
      conexoesIncluidas: plano.connectionsIncluded,
      pacotesContatosExtras,
      conexoesExtras,
      precoPlanoCents: plano.priceCents,
      precoConexoesExtrasCents,
      precoContatosExtrasCents,
      totalCents,
    };

    if (!melhor || candidato.totalCents < melhor.totalCents) {
      melhor = candidato;
    }
  }

  return melhor!;
}

/** Formata centavos em reais (pt-BR). */
export function formatarPrecoBrl(cents: number): string {
  return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}
