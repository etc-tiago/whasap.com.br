export type HistorySyncQueueMessage = {
  instanciaUuid: string;
  r2Key: string;
  receivedAt: string;
};

export type Env = {
  HYPERDRIVE: { connectionString: string };
  R2: R2Bucket;
  WORKER_NAME?: string;
};
