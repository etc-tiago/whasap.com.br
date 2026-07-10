import { S3Client } from "@aws-sdk/client-s3";

import type { R2SyncConfig } from "./config";

/** Cria cliente S3 apontando para o endpoint R2 da Cloudflare. */
export function criarClienteR2(config: R2SyncConfig): S3Client {
  return new S3Client({
    region: "auto",
    endpoint: `https://${config.accountId}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
    },
  });
}
