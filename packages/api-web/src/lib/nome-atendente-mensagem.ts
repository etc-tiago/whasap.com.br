/**
 * Monta o texto/legenda enviado ao WhatsApp com o nome do atendente na primeira linha.
 * Usa formatação `*negrito*` do WhatsApp no nome.
 *
 * @returns `*{nome}*\n{conteudo}` ou só `*{nome}*` se não houver conteúdo
 */
export function montarTextoComNomeAtendente(nome: string, conteudo?: string | null): string {
  const nomeLimpo = nome.trim();
  const nomeNegrito = `*${nomeLimpo}*`;
  const corpo = conteudo?.trim();
  if (!corpo) return nomeNegrito;
  return `${nomeNegrito}\n${corpo}`;
}

/** Tipos em que a API do WhatsApp aceita legenda na própria mídia. */
export function midiaSuportaLegenda(tipo: string): boolean {
  return tipo === "image" || tipo === "video" || tipo === "document";
}

/**
 * Tipos sem legenda confiável — o nome do atendente vai em mensagem de texto separada
 * imediatamente antes da mídia (áudio e sticker).
 */
export function midiaExigeTextoSeparadoParaNome(tipo: string): boolean {
  return tipo === "audio" || tipo === "sticker";
}
