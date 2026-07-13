import { createMetaClient, type MetaCredentials, type MetaRequestLogEntry } from "@whasap/meta";

import { putProvedorAcaoLog } from "./evolution-acao-r2-log";
import type { EvolutionGoEnv } from "./criar-cliente-evolution-go";

export type MetaEnv = EvolutionGoEnv;

/**
 * Cria cliente Meta Graph com log R2 obrigatório quando `env.R2` existe
 * (`acao/meta_cloud/...`, formato `{ request, response }`).
 */
export function criarClienteMeta(
  env: MetaEnv,
  creds: MetaCredentials,
  meta?: Record<string, string>,
) {
  const logMeta: Record<string, string> = {
    ...(env.WORKER_NAME ? { worker: env.WORKER_NAME } : {}),
    ...meta,
  };

  if (!env.R2) {
    return createMetaClient(creds);
  }

  const r2 = env.R2;
  const mergedMeta = Object.keys(logMeta).length > 0 ? logMeta : undefined;

  return createMetaClient(creds, {
    log: {
      onRequest(entry: MetaRequestLogEntry) {
        putProvedorAcaoLog(r2, {
          at: new Date().toISOString(),
          provedor: "meta_cloud",
          acao: entry.acao,
          request: {
            url: entry.url,
            tipo: entry.method,
            body: entry.requestBody,
          },
          response: {
            status: entry.status,
            body: entry.responseBody,
            error: entry.error ?? null,
            durationMs: entry.durationMs,
          },
          meta: mergedMeta,
        });
      },
    },
  });
}
