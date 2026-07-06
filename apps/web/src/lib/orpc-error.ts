import { isDefinedError } from "@orpc/client";

export function getOrpcErrorMessage(error: unknown, fallback: string): string {
  if (isDefinedError(error) && error.message) {
    return error.message;
  }
  if (error instanceof Error && error.message) {
    return error.message;
  }
  return fallback;
}
