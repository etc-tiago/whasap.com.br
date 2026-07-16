/**
 * Detecta o prefixo do nome do atendente na primeira linha do corpo.
 * Aceita formato legado (`Nome\n…`) e com negrito WhatsApp (`*Nome*\n…`).
 */
export function separarPrefixoNomeAtendente(
  corpo: string,
  enviadoPorNome: string | null | undefined,
): { nome: string; resto: string | null } | null {
  const nome = enviadoPorNome?.trim();
  if (!nome) return null;

  const candidatos = [nome, `*${nome}*`];
  for (const candidato of candidatos) {
    if (corpo === candidato) return { nome, resto: null };
    const prefixo = `${candidato}\n`;
    if (corpo.startsWith(prefixo)) {
      const resto = corpo.slice(prefixo.length);
      return { nome, resto: resto.length > 0 ? resto : null };
    }
  }

  return null;
}
