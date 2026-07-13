/**
 * Allowlist de ícones Lucide para identificar conexões WhatsApp no painel.
 * Nomes devem coincidir com exports de `lucide-react`.
 */
export const ICONES_CONEXAO = [
  "MessageCircle",
  "MessagesSquare",
  "Phone",
  "Headphones",
  "Headset",
  "Building2",
  "Store",
  "Briefcase",
  "Users",
  "UserRound",
  "HeartHandshake",
  "ShoppingCart",
  "Truck",
  "Wrench",
  "Stethoscope",
  "GraduationCap",
  "Home",
  "MapPin",
  "Bot",
  "Sparkles",
] as const;

export type IconeConexao = (typeof ICONES_CONEXAO)[number];

export const ICONE_CONEXAO_PADRAO: IconeConexao = "MessageCircle";

export function isIconeConexao(value: string): value is IconeConexao {
  return (ICONES_CONEXAO as readonly string[]).includes(value);
}
