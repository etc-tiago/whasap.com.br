import type { WebEnv } from "../types";

export type EvolutionDebugPayload = {
  statusBruto?: unknown;
  qrBruto?: unknown;
  erro?: string;
  statusHttp?: number;
};

const SENSITIVE_KEYS = new Set([
  "apikey",
  "apiKey",
  "token",
  "accessToken",
  "access_token",
  "nuvemTokenAcesso",
  "evolucaoToken",
]);

/** Ativo quando `EVOLUTION_DEBUG=true` no worker. */
export function evolutionDebugAtivo(env: WebEnv): boolean {
  return env.EVOLUTION_DEBUG === "true";
}

/** Remove chaves sensíveis de payloads debug (tokens, api keys). */
export function sanitizarDebugEvolution(value: unknown): unknown {
  if (value === null || value === undefined) return value;
  if (Array.isArray(value)) return value.map(sanitizarDebugEvolution);
  if (typeof value !== "object") return value;

  const out: Record<string, unknown> = {};
  for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
    if (SENSITIVE_KEYS.has(key)) {
      out[key] = "[redacted]";
    } else {
      out[key] = sanitizarDebugEvolution(val);
    }
  }
  return out;
}

export function montarDebugEvolution(
  env: WebEnv,
  partial: EvolutionDebugPayload,
): { _debug?: EvolutionDebugPayload } {
  if (!evolutionDebugAtivo(env)) return {};
  return {
    _debug: {
      ...partial,
      statusBruto:
        partial.statusBruto !== undefined
          ? sanitizarDebugEvolution(partial.statusBruto)
          : undefined,
      qrBruto:
        partial.qrBruto !== undefined ? sanitizarDebugEvolution(partial.qrBruto) : undefined,
    },
  };
}

export function mensagemErroEvolution(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

/** Extrai código HTTP de erros `Evolution GO error (404): ...`. */
export function statusHttpErroEvolution(err: unknown): number | undefined {
  const msg = mensagemErroEvolution(err);
  const match = msg.match(/Evolution GO error \((\d+)\)/);
  return match ? Number(match[1]) : undefined;
}
