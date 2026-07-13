import type { EvolutionSecretsEnv } from "@whasap/api-core";

export type HistorySyncQueueMessage = {
  instanciaUuid: string;
  r2Key: string;
  receivedAt: string;
};

export type Env = EvolutionSecretsEnv & {
  HYPERDRIVE: { connectionString: string };
  R2: R2Bucket;
  CDN_R2: R2Bucket;
  CDN_HMAC_SECRET?: string;
  WHATSAPP_CLOUD_WEBHOOK_SECRET?: string;
  WORKER_NAME?: string;
  /** Workflow com passos: carregar R2 → resolver instância → ingerir → mídias. */
  HISTORY_SYNC_CHUNK_WORKFLOW: Workflow<HistorySyncQueueMessage>;
};
