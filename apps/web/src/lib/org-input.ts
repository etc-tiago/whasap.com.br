import { skipToken } from "@tanstack/react-query";

/**
 * Injeta `organizacaoHash` da rota `/$organizacaoHash` nas chamadas ORPC.
 * Retorna `skipToken` quando o hash ainda não está disponível (evita query prematura).
 */
export function orgInput<T extends Record<string, unknown>>(
  organizacaoHash: string | undefined,
  input: T = {} as T,
) {
  if (!organizacaoHash) return skipToken;
  return { ...input, organizacaoHash };
}
