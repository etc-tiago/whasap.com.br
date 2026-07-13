/**
 * Helpers de CDN WhatsApp em payloads de mídia (URL / directPath).
 * Corpus real: `oe` hex = unix expiry; após expirar o GO devolve 500 com 403 embutido.
 */

const CHAVES_MIDIA = [
  "stickerMessage",
  "audioMessage",
  "imageMessage",
  "videoMessage",
  "documentMessage",
  "ptvMessage",
] as const;

/** Extrai timestamps unix (segundos) de parâmetros `oe=` hex em URLs/caminhos. */
export function extrairTimestampsOe(...caminhos: Array<string | null | undefined>): number[] {
  const out: number[] = [];
  for (const caminho of caminhos) {
    if (!caminho) continue;
    const matches = caminho.matchAll(/[?&]oe=([0-9a-fA-F]+)/g);
    for (const m of matches) {
      const hex = m[1];
      if (!hex) continue;
      const ts = Number.parseInt(hex, 16);
      if (Number.isFinite(ts) && ts > 0) out.push(ts);
    }
  }
  return out;
}

/**
 * Coleta URL/directPath de um objeto de mensagem WhatsApp (body.message do downloadmedia).
 * Aceita envelope `{ stickerMessage: {...} }` ou o bloco da mídia direto.
 */
export function coletarCaminhosMidiaWa(message: unknown): string[] {
  if (!message || typeof message !== "object") return [];
  const root = message as Record<string, unknown>;
  const blocos: Record<string, unknown>[] = [];

  for (const chave of CHAVES_MIDIA) {
    const bloco = root[chave];
    if (bloco && typeof bloco === "object") {
      blocos.push(bloco as Record<string, unknown>);
    }
  }
  if (blocos.length === 0) {
    // Payload já é o bloco da mídia (sem wrapper *Message).
    if ("directPath" in root || "URL" in root || "url" in root) {
      blocos.push(root);
    }
  }

  const caminhos: string[] = [];
  for (const bloco of blocos) {
    for (const chave of ["URL", "url", "directPath", "DirectPath"] as const) {
      const v = bloco[chave];
      if (typeof v === "string" && v.trim()) caminhos.push(v);
    }
  }
  return caminhos;
}

/**
 * True se houver ao menos um `oe=` e o mais recente já passou.
 * Sem `oe` → false (não dá para presumir; segue o download).
 */
export function cdnMidiaPresumivelmenteExpirada(
  message: unknown,
  agoraMs: number = Date.now(),
): boolean {
  const oes = extrairTimestampsOe(...coletarCaminhosMidiaWa(message));
  if (oes.length === 0) return false;
  const maisRecente = Math.max(...oes);
  return maisRecente * 1000 < agoraMs;
}
