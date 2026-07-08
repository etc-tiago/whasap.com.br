import type { SecretsStoreSecretBinding } from "./asaas-env";

/** Resolve secret de JWT de sessão (string em dev ou Secrets Store em produção). */
export async function resolveSessionJwtSecret(
  binding: SecretsStoreSecretBinding | string | undefined,
  bindingName: string,
): Promise<string> {
  if (!binding) {
    throw new Error(`${bindingName} not configured`);
  }
  if (typeof binding === "string") {
    return binding;
  }
  return binding.get();
}
