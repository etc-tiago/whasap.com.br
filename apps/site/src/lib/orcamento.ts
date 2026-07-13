import { mvpDefaults } from "@whasap/config";

export const FAIXAS_CONVERSAS = [
  { id: "0-100", label: "0 a 100 por mês", estimativa: 100, aPartirDe: false },
  { id: "100-500", label: "100 a 500 por mês", estimativa: 500, aPartirDe: false },
  { id: "500-1000", label: "500 a 1.000 por mês", estimativa: 1_000, aPartirDe: false },
  { id: "1000-5000", label: "1.000 a 5.000 por mês", estimativa: 5_000, aPartirDe: false },
  { id: "5000+", label: "+ 5 mil por mês", estimativa: 10_000, aPartirDe: true },
] as const;

export type FaixaConversasId = (typeof FAIXAS_CONVERSAS)[number]["id"];

export interface OrcamentoCalculado {
  faixaConversas: string;
  conversasEstimadas: number;
  incluidas: number;
  pacotesExtras: number;
  totalCents: number;
  aPartirDe: boolean;
  numerosWhatsapp: number;
  atendentes: number;
  /** Dias de uso antes do boleto por uso (termo de adesão). */
  billingAfterUsageDays: number;
  orgBasePriceCents: number;
  connectionPriceCents: number;
  conversationPackPriceCents: number;
}

/** Calcula investimento mensal estimado com base nos números do WhatsApp e faixa de conversas. */
export function calcularOrcamento(params: {
  numerosWhatsapp: number;
  atendentes: number;
  faixaId: FaixaConversasId;
}): OrcamentoCalculado {
  const faixa = FAIXAS_CONVERSAS.find((f) => f.id === params.faixaId) ?? FAIXAS_CONVERSAS[0];
  const {
    orgBasePriceCents,
    connectionPriceCents,
    conversationPackPriceCents,
    conversationsIncludedBase,
    conversationsPerPack,
    billingAfterUsageDays,
  } = mvpDefaults.billing;

  const incluidasBase = conversationsIncludedBase;
  const extras = Math.max(0, faixa.estimativa - incluidasBase);
  const pacotesExtras = Math.ceil(extras / conversationsPerPack);
  const incluidas = incluidasBase + pacotesExtras * conversationsPerPack;
  const totalCents =
    orgBasePriceCents +
    params.numerosWhatsapp * connectionPriceCents +
    pacotesExtras * conversationPackPriceCents;

  return {
    faixaConversas: faixa.label,
    conversasEstimadas: faixa.estimativa,
    incluidas,
    pacotesExtras,
    totalCents,
    aPartirDe: faixa.aPartirDe,
    numerosWhatsapp: params.numerosWhatsapp,
    atendentes: params.atendentes,
    billingAfterUsageDays,
    orgBasePriceCents,
    connectionPriceCents,
    conversationPackPriceCents,
  };
}

/** Formata centavos em reais (pt-BR). */
export function formatarPrecoBrl(cents: number): string {
  return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export interface OrcamentoRegistro {
  id: string;
  criadoEm: string;
  numerosWhatsapp: number;
  atendentes: number;
  faixaConversas: string;
  conversasEstimadas: number;
  totalCents: number;
  aPartirDe: boolean;
  trilha?: "whatsapp" | "videoconferencia";
  referrer?: string;
}
