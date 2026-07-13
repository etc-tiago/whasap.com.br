/**
 * Solicita sync de histórico Evolution GO e marca status na instancia_evo.
 */
import { criarClienteEvolutionGo, type EvolutionGoEnv } from "./criar-cliente-evolution-go";
import { getEvolutionCredentials, type EvolutionSecretsEnv } from "./evolution-env";
import {
  colunasInstanciaEvo,
  comTimestampAtualizacao,
  type Db,
  instanciaEvo,
} from "@whasap/db";
import { eq } from "drizzle-orm";

export type EnvSolicitarHistorico = EvolutionGoEnv & EvolutionSecretsEnv;

export type InstanciaParaSolicitarHistorico = {
  id: number;
  uuid: string;
  evo: {
    token: string | null;
    historicoSincronizadoEm: Date | null;
    historicoSincronizandoEm: Date | null;
    historicoSyncStatus?: string | null;
  } | null;
};

const LOCK_MS = 30 * 60 * 1000;

export function historicoSyncEmAndamento(
  evo: { historicoSincronizandoEm: Date | null; historicoSyncStatus?: string | null } | null,
): boolean {
  if (!evo) return false;
  if (evo.historicoSyncStatus === "requested" || evo.historicoSyncStatus === "running") {
    if (
      evo.historicoSincronizandoEm &&
      Date.now() - evo.historicoSincronizandoEm.getTime() < LOCK_MS
    ) {
      return true;
    }
  }
  if (
    evo.historicoSincronizandoEm &&
    Date.now() - evo.historicoSincronizandoEm.getTime() < LOCK_MS
  ) {
    return true;
  }
  return false;
}

/**
 * Dispara `historySync` na Evolution e marca `requested`.
 * @returns false se já em andamento ou sem token.
 */
export async function solicitarHistoricoSyncEvolution(
  db: Db,
  env: EnvSolicitarHistorico,
  instancia: InstanciaParaSolicitarHistorico,
  opts?: { forcar?: boolean; count?: number },
): Promise<{ ok: boolean; motivo?: string }> {
  if (!instancia.evo?.token) {
    return { ok: false, motivo: "Instância Evolution sem token" };
  }
  if (!opts?.forcar && historicoSyncEmAndamento(instancia.evo)) {
    return { ok: false, motivo: "Sincronização já em andamento" };
  }

  const creds = await getEvolutionCredentials(env);
  const client = criarClienteEvolutionGo(
    env,
    creds,
    { instanceToken: instancia.evo.token },
    { instanciaUuid: instancia.uuid },
  );

  await client.historySync({ count: opts?.count ?? 5000 });

  await db
    .update(instanciaEvo)
    .set(
      comTimestampAtualizacao({
        historicoSincronizandoEm: new Date(),
        historicoSyncStatus: "requested",
        historicoSyncProgress: 0,
        historicoSyncErro: null,
      }),
    )
    .where(eq(instanciaEvo.instanciaId, instancia.id));

  return { ok: true };
}

/**
 * Auto uma vez após conectar: só se nunca sincronizou e não está em andamento.
 */
export async function solicitarHistoricoSyncSePrimeiraConexao(
  db: Db,
  env: EnvSolicitarHistorico,
  instanciaIdInterno: number,
  instanciaUuid: string,
): Promise<void> {
  const evo = await db.query.instanciaEvo.findFirst({
    where: eq(instanciaEvo.instanciaId, instanciaIdInterno),
    columns: colunasInstanciaEvo,
  });
  if (!evo?.token) return;
  if (evo.historicoSincronizadoEm) return;
  if (historicoSyncEmAndamento(evo)) return;

  await solicitarHistoricoSyncEvolution(
    db,
    env,
    {
      id: instanciaIdInterno,
      uuid: instanciaUuid,
      evo: {
        token: evo.token,
        historicoSincronizadoEm: evo.historicoSincronizadoEm,
        historicoSincronizandoEm: evo.historicoSincronizandoEm,
        historicoSyncStatus: evo.historicoSyncStatus,
      },
    },
    { forcar: false },
  );
}
