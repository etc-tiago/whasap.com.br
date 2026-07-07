import type { AsaasSecretsEnv } from "@whasap/api-core";

export type Env = AsaasSecretsEnv & {
  HYPERDRIVE: { connectionString: string };
  R2: R2Bucket;
  CDN_R2: R2Bucket;
  CDN_URL: string;
  WHATSAPP_CLOUD_WEBHOOK_SECRET: string;
  ASAAS_WEBHOOK_TOKEN: string;
  EVOLUTION_BASE_URL?: string;
  EVOLUTION_API_KEY?: string;
};
