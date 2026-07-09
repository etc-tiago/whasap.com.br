import type { SecretsStoreSecretBinding } from "./asaas-env";

export type EvolutionSecretsEnv = {
  /** Secrets Store (produção) ou string JSON em `.dev.vars`: `{ "baseUrl", "apiKey" }` */
  EVOLUTION_SECRETS_STORE?: SecretsStoreSecretBinding | string;
};

export type EvolutionCredentials = {
  baseUrl: string;
  apiKey: string;
};

/**
 * Resolve credenciais Evolution do Secrets Store (ou JSON string em dev).
 * @returns `{ baseUrl, apiKey }` para o cliente Evolution GO.
 */
export async function getEvolutionCredentials(
  env: EvolutionSecretsEnv,
): Promise<EvolutionCredentials> {
  if (!env.EVOLUTION_SECRETS_STORE) {
    throw new Error("Evolution API não configurada (EVOLUTION_SECRETS_STORE)");
  }

  const raw =
    typeof env.EVOLUTION_SECRETS_STORE === "string"
      ? env.EVOLUTION_SECRETS_STORE
      : await env.EVOLUTION_SECRETS_STORE.get();

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error("EVOLUTION_SECRETS_STORE inválido (JSON malformado)");
  }

  if (
    typeof parsed !== "object" ||
    parsed === null ||
    typeof (parsed as { baseUrl?: unknown }).baseUrl !== "string" ||
    typeof (parsed as { apiKey?: unknown }).apiKey !== "string" ||
    !(parsed as { baseUrl: string }).baseUrl ||
    !(parsed as { apiKey: string }).apiKey
  ) {
    throw new Error('EVOLUTION_SECRETS_STORE inválido (exige { "baseUrl", "apiKey" })');
  }

  const { baseUrl, apiKey } = parsed as EvolutionCredentials;
  return { baseUrl, apiKey };
}
