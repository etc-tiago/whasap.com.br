export type SecretsStoreSecretBinding = {
  get(): Promise<string>;
};

export type AsaasSecretsEnv = {
  /** Secrets Store (produção) — store `ASSAS_API_KEY_ETC` */
  ASSAS_API_KEY_ETC?: SecretsStoreSecretBinding | string;
  /** Fallback local (.dev.vars) */
  ASAAS_API_KEY?: string;
  ASAAS_SANDBOX?: string;
};

export async function getAsaasApiKey(env: AsaasSecretsEnv): Promise<string> {
  if (env.ASSAS_API_KEY_ETC) {
    if (typeof env.ASSAS_API_KEY_ETC === "string") return env.ASSAS_API_KEY_ETC;
    return env.ASSAS_API_KEY_ETC.get();
  }
  if (env.ASAAS_API_KEY) return env.ASAAS_API_KEY;
  throw new Error("Asaas API key not configured (ASSAS_API_KEY_ETC)");
}

export function isAsaasSandbox(env: AsaasSecretsEnv): boolean {
  return env.ASAAS_SANDBOX === "true";
}
