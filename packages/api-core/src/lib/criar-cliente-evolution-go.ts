import {
  createEvolutionGoClient,
  type EvolutionCredentials,
  type EvolutionGoInstanceContext,
  type EvolutionGoRequestLogEntry,
} from "@whasap/evolution";

import { putEvolutionAcaoLog, derivarEvolutionAcaoLog } from "./evolution-acao-r2-log";

export type EvolutionGoEnv = {
  R2?: R2Bucket;
  /** Nome do worker para meta do log (ex.: whasap-web). */
  WORKER_NAME?: string;
};

/**
 * Cria cliente Evolution GO com log R2 opcional (`acao/{tipo}/...`).
 * Sem binding R2 no env, comportamento idêntico ao client sem log.
 */
export function criarClienteEvolutionGo(
  env: EvolutionGoEnv,
  creds: EvolutionCredentials,
  ctx?: EvolutionGoInstanceContext,
  meta?: Record<string, string>,
) {
  const logMeta: Record<string, string> = {
    ...(env.WORKER_NAME ? { worker: env.WORKER_NAME } : {}),
    ...meta,
  };

  if (!env.R2) {
    return createEvolutionGoClient(creds, ctx);
  }

  const r2 = env.R2;
  const mergedMeta = Object.keys(logMeta).length > 0 ? logMeta : undefined;

  return createEvolutionGoClient(creds, ctx, {
    log: {
      onRequest(entry: EvolutionGoRequestLogEntry) {
        putEvolutionAcaoLog(r2, {
          at: new Date().toISOString(),
          ...entry,
          derivado: derivarEvolutionAcaoLog(entry.tipo, entry.responseBody),
          meta: mergedMeta,
        });
      },
    },
  });
}
