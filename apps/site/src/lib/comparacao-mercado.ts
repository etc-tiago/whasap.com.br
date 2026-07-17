import { formatarPrecoBrl } from "@whasap/config";

import { calcularOrcamento, type OrcamentoCalculado } from "@/lib/orcamento";

/** Estimativa de mercado: plataformas que cobram por atendente (média R$50–90). */
export const PRECO_POR_ATENDENTE_CENTS = 7_000;

/** Janelas de conversa típicas por contato único/mês (contato frequente). */
export const JANELAS_POR_CONTATO_MES = 4;

/** Estimativa de preço por janela/conversa em plataformas por conversa. */
export const PRECO_POR_JANELA_CENTS = 80;

export const ROTULO_PLATAFORMA_POR_USUARIO = "Concorrente por usuário";
export const ROTULO_PLATAFORMA_POR_CONVERSA = "Concorrente por conversa";

export interface ComparacaoMercado {
  orcamento: OrcamentoCalculado;
  whasapCents: number;
  plataformaPorUsuarioCents: number;
  plataformaPorConversaCents: number;
  economiaVsUsuarioCents: number;
  economiaVsConversaCents: number;
  economiaAtendentesCents: number;
}

/**
 * Compara o orçamento Whasap com estimativas mascaradas de mercado
 * (por usuário e por conversa/janela). Valores são estimativas — não preços oficiais.
 */
export function calcularComparacaoMercado(params: {
  numerosWhatsapp: number;
  atendentes: number;
  contatosUnicos: number;
}): ComparacaoMercado {
  const orcamento = calcularOrcamento({
    numerosWhatsapp: params.numerosWhatsapp,
    atendentes: params.atendentes,
    contatosUnicos: params.contatosUnicos,
  });

  const plataformaPorUsuarioCents = params.atendentes * PRECO_POR_ATENDENTE_CENTS;
  const plataformaPorConversaCents =
    params.contatosUnicos * JANELAS_POR_CONTATO_MES * PRECO_POR_JANELA_CENTS;

  return {
    orcamento,
    whasapCents: orcamento.totalCents,
    plataformaPorUsuarioCents,
    plataformaPorConversaCents,
    economiaVsUsuarioCents: Math.max(0, plataformaPorUsuarioCents - orcamento.totalCents),
    economiaVsConversaCents: Math.max(0, plataformaPorConversaCents - orcamento.totalCents),
    economiaAtendentesCents: plataformaPorUsuarioCents,
  };
}

export { formatarPrecoBrl };
