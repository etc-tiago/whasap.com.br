import { skipToken } from "@tanstack/react-query";

export function orgInput<T extends Record<string, unknown>>(
  organizacaoHash: string | undefined,
  input: T = {} as T,
) {
  if (!organizacaoHash) return skipToken;
  return { ...input, organizacaoHash };
}
