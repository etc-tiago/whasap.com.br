import { comTimestampAtualizacao, instancia, type Db } from "@whasap/db";
import { eq } from "drizzle-orm";

/** Status pós-conexão Evolution — sempre connected (sem gate de pagamento). */
export type StatusInstanciaAposConexao = "connected";

/**
 * Marca instância Evolution como conectada.
 * Usado por polling (api-web) e webhook processor.
 */
export async function marcarInstanciaConectadaEvolution(
  db: Db,
  params: {
    instanciaIdInterno: number;
    orgIdInterno: number;
  },
): Promise<void> {
  await db
    .update(instancia)
    .set(
      comTimestampAtualizacao({
        status: "connected",
        conectadoEm: new Date(),
        desconectadoEm: null,
        sessaoRemotaLiberadaEm: null,
      }),
    )
    .where(eq(instancia.id, params.instanciaIdInterno));
}

/** Marca instância Evolution como desconectada. */
export async function marcarInstanciaDesconectadaEvolution(
  db: Db,
  instanciaIdInterno: number,
): Promise<void> {
  await db
    .update(instancia)
    .set(
      comTimestampAtualizacao({
        status: "disconnected",
        desconectadoEm: new Date(),
      }),
    )
    .where(eq(instancia.id, instanciaIdInterno));
}
