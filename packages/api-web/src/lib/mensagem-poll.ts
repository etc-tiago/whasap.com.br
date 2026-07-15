/** Enquete estruturada exposta no inbox. */
export type MensagemPoll = {
  name: string;
  options: string[];
  selectableOptionsCount?: number;
};

function pollDeMetadados(metadados: unknown): MensagemPoll | null {
  if (!metadados || typeof metadados !== "object") return null;
  const poll = (metadados as { poll?: unknown }).poll;
  if (!poll || typeof poll !== "object") return null;
  const raw = poll as {
    name?: unknown;
    options?: unknown;
    selectableOptionsCount?: unknown;
  };
  if (typeof raw.name !== "string") return null;
  if (!Array.isArray(raw.options)) return null;
  const options = raw.options.filter((o): o is string => typeof o === "string");
  const out: MensagemPoll = { name: raw.name, options };
  if (typeof raw.selectableOptionsCount === "number") {
    out.selectableOptionsCount = raw.selectableOptionsCount;
  }
  return out;
}

/** Reconstrói enquete a partir do corpo flat legado (`nome: op1, op2`). */
export function pollDeCorpoFlat(corpo: string | null): MensagemPoll | null {
  const texto = corpo?.trim() ?? "";
  if (!texto || texto === "[enquete]") return { name: "[enquete]", options: [] };
  const sep = texto.indexOf(": ");
  if (sep === -1) return { name: texto, options: [] };
  return {
    name: texto.slice(0, sep) || "[enquete]",
    options: texto
      .slice(sep + 2)
      .split(", ")
      .filter(Boolean),
  };
}

/** Resolve poll a partir de metadados ou fallback do corpo. */
export function mapearPollMensagem(
  tipo: string,
  corpo: string | null,
  metadados: unknown,
): MensagemPoll | null {
  if (tipo !== "poll") return null;
  return pollDeMetadados(metadados) ?? pollDeCorpoFlat(corpo);
}
