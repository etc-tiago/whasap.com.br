import type { EvolutionSecretsEnv } from "@whasap/api-core";

export type Env = EvolutionSecretsEnv & {
  HYPERDRIVE: { connectionString: string };
  R2: R2Bucket;
  CDN_R2: R2Bucket;
  CDN_URL: string;
  WORKER_NAME?: string;
  WHATSAPP_CLOUD_WEBHOOK_SECRET: string;
  CDN_HMAC_SECRET?: string;
  HISTORY_SYNC_QUEUE: Queue<{
    instanciaUuid: string;
    r2Key: string;
    receivedAt: string;
  }>;
};
