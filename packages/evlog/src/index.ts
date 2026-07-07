import { log } from "evlog";

export { createError, log, parseError } from "evlog";
export type { RequestLogger } from "evlog";

export { criarServerTanstackEvlog } from "./tanstack-server";
export { envolverWorkerFetch, garantirWorkersLogger } from "./workers";
export { SERVICOS, type ServicoEvlog } from "./servicos";

/** Registra erro estruturado (server handler, RPC, workers). */
export function registrarErro(contexto: string, erro: unknown): void {
  log.error({
    contexto,
    erro: erro instanceof Error ? erro.message : String(erro),
    cause: erro instanceof Error && erro.cause !== undefined ? String(erro.cause) : undefined,
  });
}
