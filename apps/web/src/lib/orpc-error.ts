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
