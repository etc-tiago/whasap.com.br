type ComponenteTemplate = {
  type?: string;
  text?: string;
};

function componentesComoLista(componentes: unknown): ComponenteTemplate[] {
  if (!Array.isArray(componentes)) return [];
  return componentes.filter(
    (item): item is ComponenteTemplate => typeof item === "object" && item !== null,
  );
}

/** Texto do componente BODY de um template Meta/WhatsApp. */
export function textoCorpoTemplate(componentes: unknown): string | null {
  const body = componentesComoLista(componentes).find((c) => c.type === "BODY");
  return body?.text ?? null;
}

/** Índices numéricos das variáveis `{{1}}`, `{{2}}`, … no corpo do template, em ordem. */
export function extrairIndicesVariaveisTemplate(componentes: unknown): string[] {
  const texto = textoCorpoTemplate(componentes);
  if (!texto) return [];

  const matches = texto.match(/\{\{(\d+)\}\}/g) ?? [];
  const indices = matches.map((m) => m.replace(/\{|\}/g, ""));
  return [...new Set(indices)].toSorted((a, b) => Number(a) - Number(b));
}
