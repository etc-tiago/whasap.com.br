import { mvpDefaults } from "@whasap/config";
import {
  colunasInstanciaEvo,
  comTimestampAtualizacao,
  instancia,
  instanciaEvo,
  type Db,
} from "@whasap/db";
import { parseGoConnectionState } from "@whasap/evolution";
import { and, eq, inArray, isNull } from "drizzle-orm";

import { criarClienteEvolutionGo, type EvolutionGoEnv } from "./criar-cliente-evolution-go";
import { getEvolutionCredentials, type EvolutionSecretsEnv } from "./evolution-env";
import { marcarInstanciaConectadaEvolution } from "./instancia-evolution";

export const STATUS_SWEEP_EVOLUTION = [
  "pending_connection",
  "provisioning",
  "disconnected",
] as const;

export type StatusSweepEvolution = (typeof STATUS_SWEEP_EVOLUTION)[number];

export type InstanciaParaCriterioAbandono = {
  status: string;
  criadoEm: Date;
  atualizadoEm: Date;
  conectadoEm: Date | null;
  desconectadoEm: Date | null;
};

export type InstanciaEvolutionAbandonadaRow = {
  id: number;
  uuid: string;
  organizacaoId: number;
  nome: string;
  status: StatusSweepEvolution;
  limiteConversas: number;
  conectadoEm: Date | null;
  desconectadoEm: Date | null;
  criadoEm: Date;
  atualizadoEm: Date;
  evo: {
    nomeInstancia: string | null;
    instanceId: string | null;
    token: string | null;
  } | null;
};

export type EnvDescarteEvolution = EvolutionSecretsEnv & EvolutionGoEnv;

/** @deprecated Preferir `ResultadoLiberacaoEvolution`. */
export type ResultadoDescarteEvolution = ResultadoLiberacaoEvolution;

export type ResultadoLiberacaoEvolution = {
  instanciaId: number;
  uuid: string;
  /** True quando getStatus remoto ainda estava open e a row foi remarcada connected. */
  remarcadaConnected: boolean;
};

export type ResultadoVarreduraEvolution = {
  candidatas: number;
  liberadas: number;
  falhas: number;
  remarcadasConnected: number;
};

/**
 * Momento de referência para o timeout de abandono.
 * - never-paired (`conectadoEm` null): `criadoEm` (pending/provisioning) ou `desconectadoEm`/`atualizadoEm` (disconnected)
 * - já usou + `disconnected`: `desconectadoEm` (fallback `atualizadoEm`)
 * - já usou + pending/provisioning (ex. pós-encerrarPareamento): `atualizadoEm`
 */
export function resolverReferenciaAbandonoEvolution(
  row: InstanciaParaCriterioAbandono,
): Date | null {
  if (row.conectadoEm == null) {
    if (row.status === "pending_connection" || row.status === "provisioning") {
      return row.criadoEm;
    }
    if (row.status === "disconnected") {
      return row.desconectadoEm ?? row.atualizadoEm;
    }
    return null;
  }

  if (row.status === "disconnected") {
    return row.desconectadoEm ?? row.atualizadoEm;
  }
  if (row.status === "pending_connection" || row.status === "provisioning") {
    return row.atualizadoEm;
  }
  return null;
}

/**
 * Timeout em ms: never-paired → `abandonedAfterMinutes`; já usou → `abandonedAfterUseDays`.
 */
export function resolverTimeoutAbandonoMs(
  row: InstanciaParaCriterioAbandono,
  abandonedAfterMinutes: number = mvpDefaults.evolution.abandonedAfterMinutes,
  abandonedAfterUseDays: number = mvpDefaults.evolution.abandonedAfterUseDays,
): number | null {
  if (resolverReferenciaAbandonoEvolution(row) == null) return null;
  if (row.conectadoEm == null) {
    return abandonedAfterMinutes * 60_000;
  }
  return abandonedAfterUseDays * 24 * 60 * 60_000;
}

/** True se a instância está fora do status operacional além do timeout da política aplicável. */
export function instanciaEvolutionEstaAbandonada(
  row: InstanciaParaCriterioAbandono,
  agora: Date,
  abandonedAfterMinutes: number = mvpDefaults.evolution.abandonedAfterMinutes,
  abandonedAfterUseDays: number = mvpDefaults.evolution.abandonedAfterUseDays,
): boolean {
  const referencia = resolverReferenciaAbandonoEvolution(row);
  const timeoutMs = resolverTimeoutAbandonoMs(row, abandonedAfterMinutes, abandonedAfterUseDays);
  if (!referencia || timeoutMs == null) return false;
  return agora.getTime() - referencia.getTime() >= timeoutMs;
}

async function limparSessaoEvolutionRemota(
  env: EnvDescarteEvolution,
  row: InstanciaEvolutionAbandonadaRow,
): Promise<void> {
  const creds = await getEvolutionCredentials(env);
  const meta = {
    origem: "evolution_cleanup",
    instanciaUuid: row.uuid,
  };

  if (row.evo?.token) {
    try {
      const client = criarClienteEvolutionGo(env, creds, { instanceToken: row.evo.token }, meta);
      await client.disconnect();
    } catch {
      // best-effort
    }
  }

  const evolutionId = row.evo?.instanceId ?? row.uuid;
  try {
    const admin = criarClienteEvolutionGo(env, creds, undefined, meta);
    await admin.deleteInstance(evolutionId);
  } catch {
    // best-effort
  }
}

/**
 * Se a sessão remota ainda está open, remarca connected e aborta a liberação.
 * @returns true se remarcou (não liberar).
 */
async function tentarRemarcarSeAindaConectada(
  db: Db,
  env: EnvDescarteEvolution,
  row: InstanciaEvolutionAbandonadaRow,
): Promise<boolean> {
  if (!row.evo?.token) return false;

  try {
    const creds = await getEvolutionCredentials(env);
    const client = criarClienteEvolutionGo(
      env,
      creds,
      { instanceToken: row.evo.token },
      { origem: "evolution_cleanup", instanciaUuid: row.uuid },
    );
    const statusBruto = await client.getStatus();
    if (parseGoConnectionState(statusBruto) !== "open") return false;

    await marcarInstanciaConectadaEvolution(db, {
      instanciaIdInterno: row.id,
      orgIdInterno: row.organizacaoId,
    });
    return true;
  } catch {
    return false;
  }
}

/**
 * Libera sessão Evolution abandonada: delete remoto + zera creds operacionais +
 * `sessaoRemotaLiberadaEm`. Não soft-delete e não reincarna row.
 * Preserva `historicoSincronizadoEm` e demais metadados de sync em `instancia_evo`.
 */
export async function liberarSessaoEvolutionAbandonada(
  db: Db,
  env: EnvDescarteEvolution,
  row: InstanciaEvolutionAbandonadaRow,
): Promise<ResultadoLiberacaoEvolution> {
  const remarcada = await tentarRemarcarSeAindaConectada(db, env, row);
  if (remarcada) {
    return { instanciaId: row.id, uuid: row.uuid, remarcadaConnected: true };
  }

  await limparSessaoEvolutionRemota(env, row);

  // Só zera credenciais operacionais — não toca historicoSincronizadoEm / sync status.
  await db
    .update(instanciaEvo)
    .set(
      comTimestampAtualizacao({
        nomeInstancia: null,
        instanceId: null,
        token: null,
      }),
    )
    .where(eq(instanciaEvo.instanciaId, row.id));

  const statusPainel =
    row.conectadoEm == null ? ("pending_connection" as const) : ("disconnected" as const);

  await db
    .update(instancia)
    .set(
      comTimestampAtualizacao({
        status: statusPainel,
        sessaoRemotaLiberadaEm: new Date(),
      }),
    )
    .where(eq(instancia.id, row.id));

  return { instanciaId: row.id, uuid: row.uuid, remarcadaConnected: false };
}

/**
 * @deprecated Use `liberarSessaoEvolutionAbandonada`.
 * Mantido para compat de imports; mesmo comportamento (sem soft-delete).
 */
export async function descartarInstanciaEvolutionAbandonada(
  db: Db,
  env: EnvDescarteEvolution,
  row: InstanciaEvolutionAbandonadaRow,
): Promise<ResultadoLiberacaoEvolution> {
  return liberarSessaoEvolutionAbandonada(db, env, row);
}

/** Lista candidatas evo não excluídas, ainda sem sessão liberada, nos status do sweep. */
export async function listarInstanciasEvolutionParaSweep(
  db: Db,
): Promise<InstanciaEvolutionAbandonadaRow[]> {
  const rows = await db.query.instancia.findMany({
    where: and(
      eq(instancia.provedor, "evo"),
      isNull(instancia.excluidoEm),
      isNull(instancia.sessaoRemotaLiberadaEm),
      inArray(instancia.status, [...STATUS_SWEEP_EVOLUTION]),
    ),
    columns: {
      id: true,
      uuid: true,
      organizacaoId: true,
      nome: true,
      status: true,
      limiteConversas: true,
      conectadoEm: true,
      desconectadoEm: true,
      criadoEm: true,
      atualizadoEm: true,
    },
    with: {
      evo: { columns: colunasInstanciaEvo },
    },
  });

  return rows.map((row) => ({
    id: row.id,
    uuid: row.uuid,
    organizacaoId: row.organizacaoId,
    nome: row.nome,
    status: row.status as StatusSweepEvolution,
    limiteConversas: row.limiteConversas,
    conectadoEm: row.conectadoEm,
    desconectadoEm: row.desconectadoEm,
    criadoEm: row.criadoEm,
    atualizadoEm: row.atualizadoEm,
    evo: row.evo
      ? {
          nomeInstancia: row.evo.nomeInstancia,
          instanceId: row.evo.instanceId,
          token: row.evo.token,
        }
      : null,
  }));
}

/**
 * Varre instâncias Evolution abandonadas e libera a sessão remota de cada uma
 * (erros por item não abortam o lote). Soft-delete só via ação do usuário.
 */
export async function varrerInstanciasEvolutionAbandonadas(
  db: Db,
  env: EnvDescarteEvolution,
  agora: Date = new Date(),
  abandonedAfterMinutes: number = mvpDefaults.evolution.abandonedAfterMinutes,
  abandonedAfterUseDays: number = mvpDefaults.evolution.abandonedAfterUseDays,
): Promise<ResultadoVarreduraEvolution> {
  const candidatas = await listarInstanciasEvolutionParaSweep(db);
  const abandonadas = candidatas.filter((row) =>
    instanciaEvolutionEstaAbandonada(row, agora, abandonedAfterMinutes, abandonedAfterUseDays),
  );

  const resultados = await Promise.allSettled(
    abandonadas.map((row) => liberarSessaoEvolutionAbandonada(db, env, row)),
  );
  let liberadas = 0;
  let falhas = 0;
  let remarcadasConnected = 0;
  for (const r of resultados) {
    if (r.status === "rejected") {
      falhas += 1;
      continue;
    }
    if (r.value.remarcadaConnected) remarcadasConnected += 1;
    else liberadas += 1;
  }

  return { candidatas: abandonadas.length, liberadas, falhas, remarcadasConnected };
}
