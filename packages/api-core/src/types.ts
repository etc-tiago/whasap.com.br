import type { Db } from "@whasap/db";

export type AuthRateLimiter = {
  limit(options: { key: string }): Promise<{ success: boolean }>;
};

export type BaseEnv = {
  HYPERDRIVE: { connectionString: string };
  AUTH_RATE_LIMIT?: AuthRateLimiter;
  EMAIL_FROM: string;
};

export type DbContext = {
  db: Db;
  env: BaseEnv;
  clientIp?: string;
};
