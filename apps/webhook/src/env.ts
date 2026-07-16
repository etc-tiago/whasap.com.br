import type { EvolutionSecretsEnv } from "@whasap/api-core";

export type Env = EvolutionSecretsEnv & {
  HYPERDRIVE: { connectionString: string };
  R2: R2Bucket;
  CDN_R2: R2Bucket;
  CDN_URL: string;
  WORKER_NAME?: string;
  /** Fallback de HMAC do CDN se `CDN_HMAC_SECRET` ausente (não é mais o verify token Meta). */
  WHATSAPP_CLOUD_WEBHOOK_SECRET?: string;
  CDN_HMAC_SECRET?: string;
  HISTORY_SYNC_QUEUE: Queue<{
    instanciaUuid: string;
    r2Key: string;
    receivedAt: string;
  }>;
};
