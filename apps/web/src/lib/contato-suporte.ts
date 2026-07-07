export const VENDAS_WHATSAPP = import.meta.env.VITE_VENDAS_WHATSAPP ?? "";
export const AGENDAMENTO_URL =
  import.meta.env.VITE_AGENDAMENTO_URL ??
  "https://cal.com/explore-the-curiosity-nn0cbd/orcamento-whasap";

export function urlWhatsappSuporte(): string | null {
  if (!VENDAS_WHATSAPP) return null;
  const texto = encodeURIComponent(
    "Olá! Preciso de ajuda para acessar ou criar minha conta no Whasap.",
  );
  return `https://wa.me/${VENDAS_WHATSAPP.replace(/\D/g, "")}?text=${texto}`;
}
