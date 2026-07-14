const STORAGE_KEY = "whasap_ref_indicacao";

/** Persiste o código de indicação (?ref=) para anexar a leads e CTAs. */
export function salvarRefIndicacao(ref: string | undefined | null): void {
  if (typeof window === "undefined") return;
  const valor = ref?.trim();
  if (!valor) return;
  try {
    sessionStorage.setItem(STORAGE_KEY, valor);
  } catch {
    // ignore quota / private mode
  }
}

/** Lê o código de indicação salvo nesta sessão do navegador. */
export function lerRefIndicacao(): string | undefined {
  if (typeof window === "undefined") return undefined;
  try {
    const valor = sessionStorage.getItem(STORAGE_KEY)?.trim();
    return valor || undefined;
  } catch {
    return undefined;
  }
}
