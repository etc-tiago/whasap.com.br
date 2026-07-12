import type { EvolutionSecretsEnv } from "@whasap/api-core";

export type Env = EvolutionSecretsEnv & {
  HYPERDRIVE: { connectionString: string };
  R2: R2Bucket;
  WORKER_NAME?: string;
};
