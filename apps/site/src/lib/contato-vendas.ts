import { formatarPrecoBrl, type OrcamentoCalculado } from "@/lib/orcamento";

export const VENDAS_WHATSAPP = import.meta.env.VITE_VENDAS_WHATSAPP ?? "";
export const AGENDAMENTO_URL =
  import.meta.env.VITE_AGENDAMENTO_URL ??
  "https://cal.com/explore-the-curiosity-nn0cbd/orcamento-whasap";

/** Monta resumo textual do orçamento para WhatsApp, Cal.com e logs. */
export function montarResumoOrcamento(orcamento: OrcamentoCalculado): string {
  const total = orcamento.aPartirDe
    ? `a partir de ${formatarPrecoBrl(orcamento.totalCents)}/mês`
    : `${formatarPrecoBrl(orcamento.totalCents)}/mês`;

  return [
    `${orcamento.numerosWhatsapp} número(s) do WhatsApp`,
    `${orcamento.atendentes} atendentes na equipe`,
    `${orcamento.faixaConversas}`,
    `Estimativa: ${total}`,
  ].join(" · ");
}

/** Mensagem pré-preenchida para wa.me (tom humano, primeira pessoa). */
export function montarMensagemWhatsapp(orcamento: OrcamentoCalculado): string {
  const total = orcamento.aPartirDe
    ? `a partir de ${formatarPrecoBrl(orcamento.totalCents)}/mês`
    : `${formatarPrecoBrl(orcamento.totalCents)}/mês`;

  const numeros =
    orcamento.numerosWhatsapp === 1
      ? "1 número do WhatsApp"
      : `${orcamento.numerosWhatsapp} números do WhatsApp`;

  return [
    "Olá! Fiz uma simulação no site do Whasap e queria validar com vocês:",
    `• ${numeros}`,
    `• ${orcamento.atendentes} atendentes na equipe`,
    `• ${orcamento.faixaConversas}`,
    `• Estimativa: ${total}`,
    "",
    "Podem me ajudar a entender se esse plano faz sentido para minha operação?",
  ].join("\n");
}

/** URL wa.me com mensagem codificada. */
export function montarUrlWhatsapp(orcamento: OrcamentoCalculado): string {
  if (!VENDAS_WHATSAPP) return "#";
  const texto = encodeURIComponent(montarMensagemWhatsapp(orcamento));
  return `https://wa.me/${VENDAS_WHATSAPP.replace(/\D/g, "")}?text=${texto}`;
}

/** URL Cal.com com resumo em notes. */
export function montarUrlAgendamento(orcamento: OrcamentoCalculado): string {
  const notes = encodeURIComponent(
    `Orçamento Whasap (simulação no site):\n${montarResumoOrcamento(orcamento).replace(/ · /g, "\n")}`,
  );
  const separador = AGENDAMENTO_URL.includes("?") ? "&" : "?";
  return `${AGENDAMENTO_URL}${separador}notes=${notes}`;
}
