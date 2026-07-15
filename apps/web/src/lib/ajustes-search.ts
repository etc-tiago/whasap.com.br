/** Seções do modal global de Ajustes (`?ajustes=`). */
export const AJUSTES_SECOES = [
  "geral",
  "usuarios",
  "conexao",
  "etiquetas",
  "campanha",
  "indique",
] as const;

export type AjustesSecao = (typeof AJUSTES_SECOES)[number];

export type OrganizacaoSearch = {
  ajustes?: AjustesSecao;
  /** Abre o popover de convite na seção Usuários. */
  convidar?: "1";
};

/**
 * Extrai search params globais da org (`ajustes`, `convidar`) a partir da URL.
 */
export function validarOrganizacaoSearch(s: Record<string, unknown>): OrganizacaoSearch {
  const out: OrganizacaoSearch = {};
  const ajustes = s.ajustes;
  if (typeof ajustes === "string" && (AJUSTES_SECOES as readonly string[]).includes(ajustes)) {
    out.ajustes = ajustes as AjustesSecao;
  }
  if (s.convidar === "1" || s.convidar === true || s.convidar === 1) {
    out.convidar = "1";
  }
  return out;
}
