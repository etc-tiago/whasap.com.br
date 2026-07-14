import { isDefinedError } from "@orpc/client";

export function getOrpcErrorMessage(error: unknown, fallback: string): string {
  if (isDefinedError(error)) {
    const message = (error as { message?: string }).message;
    if (message) return message;
  }
  if (error instanceof Error && error.message) {
    return error.message;
  }
  return fallback;
}

/** True quando o ORPC / RPC retornou 401 (cookie JWT ausente ou inválido). */
export function eSessaoNaoAutorizada(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const code = (error as { code?: unknown }).code;
  if (code === "UNAUTHORIZED") return true;
  const status = (error as { status?: unknown }).status;
  return status === 401;
}
