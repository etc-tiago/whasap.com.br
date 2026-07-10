/** Índices de cor de etiqueta WhatsApp (Evolution GO `color` inteiro). */
const CORES_WHATSAPP = [
  "#ff9485",
  "#64c4ff",
  "#ffd429",
  "#dfaef0",
  "#99d8ff",
  "#83e421",
  "#ffaf04",
  "#ff6b6b",
  "#7fd4c9",
  "#ff8cc8",
] as const;

/** Mapeia cor hex do painel para índice WhatsApp; default 0. */
export function corPainelParaIndiceWhatsapp(cor: string | null | undefined): number {
  if (!cor) return 0;
  const normalized = cor.trim().toLowerCase();
  const idx = CORES_WHATSAPP.findIndex((c) => c === normalized);
  if (idx >= 0) return idx;
  return 0;
}

/** Mapeia índice WhatsApp para hex (exibição no painel). */
export function indiceWhatsappParaCorPainel(indice: number): string {
  return CORES_WHATSAPP[indice] ?? CORES_WHATSAPP[0];
}

export function jidDeContato(telefone: string, idExterno?: string | null): string {
  if (idExterno?.includes("@")) return idExterno;
  const digits = telefone.replace(/\D/g, "");
  if (idExterno?.endsWith("@g.us") || digits.length > 15) {
    return `${digits}@g.us`;
  }
  return `${digits}@s.whatsapp.net`;
}

/** Extrai labelId da resposta Evolution GO /label/edit ou /label/list. */
export function extrairLabelIdResposta(resposta: unknown): string | null {
  if (!resposta || typeof resposta !== "object") return null;
  const obj = resposta as Record<string, unknown>;
  const data = obj.data as Record<string, unknown> | undefined;

  const candidates = [obj.labelId, obj.label_id, obj.id, data?.labelId, data?.label_id, data?.id];

  for (const candidate of candidates) {
    if (candidate !== undefined && candidate !== null && String(candidate).length > 0) {
      return String(candidate);
    }
  }

  if (Array.isArray(data)) {
    const last = data.at(-1) as Record<string, unknown> | undefined;
    if (last?.id) return String(last.id);
    if (last?.labelId) return String(last.labelId);
  }

  return null;
}
