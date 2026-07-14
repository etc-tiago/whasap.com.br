import {
  calcularInvestimentoMensal,
  formatarPrecoBrl,
  mvpDefaults,
  type InvestimentoMensalCalculado,
} from "@whasap/config";

export { formatarPrecoBrl };

export const FAIXAS_CONTATOS = [
  { id: "0-100", label: "0 a 100 por mês", estimativa: 100, aPartirDe: false },
  { id: "100-500", label: "100 a 500 por mês", estimativa: 500, aPartirDe: false },
  { id: "500-1000", label: "500 a 1.000 por mês", estimativa: 1_000, aPartirDe: false },
  { id: "1000-5000", label: "1.000 a 5.000 por mês", estimativa: 5_000, aPartirDe: false },
  { id: "5000+", label: "+ 5 mil por mês", estimativa: 10_000, aPartirDe: true },
] as const;

export type FaixaContatosId = (typeof FAIXAS_CONTATOS)[number]["id"];

export interface OrcamentoCalculado extends InvestimentoMensalCalculado {
  faixaContatos: string;
  aPartirDe: boolean;
  atendentes: number;
  billingAfterUsageDays: number;
}

/** Calcula investimento mensal estimado com base nas conexões e faixa de contatos únicos. */
export function calcularOrcamento(params: {
  numerosWhatsapp: number;
  atendentes: number;
  faixaId: FaixaContatosId;
}): OrcamentoCalculado {
  const faixa = FAIXAS_CONTATOS.find((f) => f.id === params.faixaId) ?? FAIXAS_CONTATOS[0];
  const investimento = calcularInvestimentoMensal({
    contatosUnicos: faixa.estimativa,
    conexoes: params.numerosWhatsapp,
  });

  return {
    ...investimento,
    faixaContatos: faixa.label,
    aPartirDe: faixa.aPartirDe,
    atendentes: params.atendentes,
    billingAfterUsageDays: mvpDefaults.billing.billingAfterUsageDays,
  };
}

export interface OrcamentoRegistro {
  id: string;
  criadoEm: string;
  numerosWhatsapp: number;
  atendentes: number;
  faixaContatos: string;
  contatosEstimados: number;
  planoId: string;
  planoNome: string;
  totalCents: number;
  aPartirDe: boolean;
  trilha?: "whatsapp" | "videoconferencia";
  /** HTTP document.referrer */
  referrer?: string;
  /** Código/hash da org que indicou (?ref=) */
  refIndicacao?: string;
}
