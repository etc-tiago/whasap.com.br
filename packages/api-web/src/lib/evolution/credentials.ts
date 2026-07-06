import { parseEvolutionCredentials, evolutionSecretName } from "@whasap/evolution";

import type { SecretsStoreBinding, WebEnv } from "../../types";

export async function getEvolutionCredentials(
  env: WebEnv,
  organizationId: string,
  instanceId: string,
): Promise<ReturnType<typeof parseEvolutionCredentials>> {
  const store = env.EVOLUTION_SECRETS_STORE;
  if (!store) {
    throw new Error("EVOLUTION_SECRETS_STORE binding not configured");
  }
  const name = evolutionSecretName(organizationId, instanceId);
  const raw = await store.get(name);
  return parseEvolutionCredentials(raw);
}

export type { SecretsStoreBinding };
