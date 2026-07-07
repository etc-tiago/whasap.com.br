export type SecretsStoreSecretBinding = {
  get(): Promise<string>;
};

export type AsaasSecretsEnv = {
  /** Secrets Store (produção) ou string em `.dev.vars` */
  ASSAS_API_KEY?: SecretsStoreSecretBinding | string;
  ASAAS_SANDBOX?: string;
};

export async function getAsaasApiKey(env: AsaasSecretsEnv): Promise<string> {
  if (env.ASSAS_API_KEY) {
    if (typeof env.ASSAS_API_KEY === "string") return env.ASSAS_API_KEY;
    return env.ASSAS_API_KEY.get();
  }
  throw new Error("Asaas API key not configured (ASSAS_API_KEY)");
}

export function isAsaasSandbox(env: AsaasSecretsEnv): boolean {
  return env.ASAAS_SANDBOX === "true";
}
