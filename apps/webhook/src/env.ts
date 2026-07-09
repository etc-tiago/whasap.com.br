import type { AsaasSecretsEnv, EvolutionSecretsEnv } from "@whasap/api-core";

export type Env = AsaasSecretsEnv &
  EvolutionSecretsEnv & {
    HYPERDRIVE: { connectionString: string };
    R2: R2Bucket;
    CDN_R2: R2Bucket;
    CDN_URL: string;
    WORKER_NAME?: string;
    WHATSAPP_CLOUD_WEBHOOK_SECRET: string;
    ASAAS_WEBHOOK_TOKEN: string;
  };
