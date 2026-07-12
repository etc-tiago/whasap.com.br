import { comTimestampAtualizacao, instancia, organizacao, type Db } from "@whasap/db";
import { and, eq, isNull } from "drizzle-orm";

export type StatusInstanciaAposConexao = "connected" | "pending_payment";

/** Status pós-conexão Evolution: assinatura ativa → connected; caso contrário pending_payment. */
export function resolverStatusAposConexaoEvolution(
  asaasIdAssinatura: string | null | undefined,
): StatusInstanciaAposConexao {
  return asaasIdAssinatura ? "connected" : "pending_payment";
}

/** Inicia contagem da demonstração na 1ª conexão (idempotente). */
export async function iniciarDemonstracaoSeNecessarioDb(
  db: Db,
  orgIdInterno: number,
): Promise<void> {
  const org = await db.query.organizacao.findFirst({
    where: and(eq(organizacao.id, orgIdInterno), isNull(organizacao.excluidoEm)),
    columns: { id: true, demonstracaoIniciaEm: true },
  });
  if (!org || org.demonstracaoIniciaEm) return;

  await db
    .update(organizacao)
    .set(comTimestampAtualizacao({ demonstracaoIniciaEm: new Date() }))
    .where(eq(organizacao.id, orgIdInterno));
}

/**
 * Marca instância Evolution como conectada (ou pending_payment) e inicia demo da org.
 * Usado por polling (api-web) e webhook processor.
 */
export async function marcarInstanciaConectadaEvolution(
  db: Db,
  params: {
    instanciaIdInterno: number;
    orgIdInterno: number;
    asaasIdAssinatura: string | null | undefined;
  },
): Promise<void> {
  const status = resolverStatusAposConexaoEvolution(params.asaasIdAssinatura);

  await db
    .update(instancia)
    .set(
      comTimestampAtualizacao({
        status,
        conectadoEm: new Date(),
        desconectadoEm: null,
      }),
    )
    .where(eq(instancia.id, params.instanciaIdInterno));

  await iniciarDemonstracaoSeNecessarioDb(db, params.orgIdInterno);
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
