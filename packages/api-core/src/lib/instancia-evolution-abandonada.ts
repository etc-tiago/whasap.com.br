import { mvpDefaults } from "@whasap/config";
import {
  colunasInstanciaEvo,
  comTimestampAtualizacao,
  comTimestampsCriacao,
  instancia,
  instanciaAddon,
  instanciaEvo,
  marcarExclusaoLogica,
  type Db,
} from "@whasap/db";
import { and, eq, inArray, isNull } from "drizzle-orm";

import { criarClienteEvolutionGo, type EvolutionGoEnv } from "./criar-cliente-evolution-go";
import { getEvolutionCredentials, type EvolutionSecretsEnv } from "./evolution-env";

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
  asaasIdAssinatura: string | null;
  limiteConversas: number;
  trialTerminaEm: Date | null;
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

export type ResultadoDescarteEvolution = {
  instanciaId: number;
  uuid: string;
  reincarnadaId: number | null;
};

export type ResultadoVarreduraEvolution = {
  candidatas: number;
  descartadas: number;
  falhas: number;
};

/**
 * Momento de referência para o timeout de abandono.
 * - `disconnected`: `desconectadoEm` (fallback `atualizadoEm` para rows legados)
 * - `pending_connection` / `provisioning` sem conexão: `criadoEm`
 * - mesmos status após ter conectado (ex.: pós-encerrarPareamento): `atualizadoEm`
 */
export function resolverReferenciaAbandonoEvolution(
  row: InstanciaParaCriterioAbandono,
): Date | null {
  if (row.status === "disconnected") {
    return row.desconectadoEm ?? row.atualizadoEm;
  }
  if (row.status === "pending_connection" || row.status === "provisioning") {
    return row.conectadoEm == null ? row.criadoEm : row.atualizadoEm;
  }
  return null;
}

/** True se a instância está fora do status operacional há pelo menos `abandonedAfterMinutes`. */
export function instanciaEvolutionEstaAbandonada(
  row: InstanciaParaCriterioAbandono,
  agora: Date,
  abandonedAfterMinutes: number = mvpDefaults.evolution.abandonedAfterMinutes,
): boolean {
  const referencia = resolverReferenciaAbandonoEvolution(row);
  if (!referencia) return false;
  return agora.getTime() - referencia.getTime() >= abandonedAfterMinutes * 60_000;
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
 * Soft-delete da instância Evolution abandonada + limpeza no provedor.
 * Com assinatura Asaas: transfere o slot para uma nova `pending_connection` (e move addons).
 */
export async function descartarInstanciaEvolutionAbandonada(
  db: Db,
  env: EnvDescarteEvolution,
  row: InstanciaEvolutionAbandonadaRow,
): Promise<ResultadoDescarteEvolution> {
  await limparSessaoEvolutionRemota(env, row);

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

  const asaasIdAssinatura = row.asaasIdAssinatura;
  let reincarnadaId: number | null = null;

  if (asaasIdAssinatura) {
    await db
      .update(instancia)
      .set(comTimestampAtualizacao({ asaasIdAssinatura: null }))
      .where(eq(instancia.id, row.id));

    await db.update(instancia).set(marcarExclusaoLogica()).where(eq(instancia.id, row.id));

    const [nova] = await db
      .insert(instancia)
      .values(
        comTimestampsCriacao({
          organizacaoId: row.organizacaoId,
          nome: row.nome,
          provedor: "evo" as const,
          status: "pending_connection" as const,
          asaasIdAssinatura,
          limiteConversas: row.limiteConversas,
          trialTerminaEm: row.trialTerminaEm,
        }),
      )
      .returning({ id: instancia.id });

    reincarnadaId = nova?.id ?? null;

    if (reincarnadaId != null) {
      await db
        .update(instanciaAddon)
        .set({ instanciaId: reincarnadaId })
        .where(eq(instanciaAddon.instanciaId, row.id));
    }
  } else {
    await db.update(instancia).set(marcarExclusaoLogica()).where(eq(instancia.id, row.id));
  }

  return { instanciaId: row.id, uuid: row.uuid, reincarnadaId };
}

/** Lista candidatas evo não excluídas nos status do sweep. */
export async function listarInstanciasEvolutionParaSweep(
  db: Db,
): Promise<InstanciaEvolutionAbandonadaRow[]> {
  const rows = await db.query.instancia.findMany({
    where: and(
      eq(instancia.provedor, "evo"),
      isNull(instancia.excluidoEm),
      inArray(instancia.status, [...STATUS_SWEEP_EVOLUTION]),
    ),
    columns: {
      id: true,
      uuid: true,
      organizacaoId: true,
      nome: true,
      status: true,
      asaasIdAssinatura: true,
      limiteConversas: true,
      trialTerminaEm: true,
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
    asaasIdAssinatura: row.asaasIdAssinatura,
    limiteConversas: row.limiteConversas,
    trialTerminaEm: row.trialTerminaEm,
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
 * Varre instâncias Evolution abandonadas e descarta cada uma (erros por item não abortam o lote).
 * @returns Contadores do lote para log do evolution-cleanup.
 */
export async function varrerInstanciasEvolutionAbandonadas(
  db: Db,
  env: EnvDescarteEvolution,
  agora: Date = new Date(),
  abandonedAfterMinutes: number = mvpDefaults.evolution.abandonedAfterMinutes,
): Promise<ResultadoVarreduraEvolution> {
  const candidatas = await listarInstanciasEvolutionParaSweep(db);
  const abandonadas = candidatas.filter((row) =>
    instanciaEvolutionEstaAbandonada(row, agora, abandonedAfterMinutes),
  );

  let descartadas = 0;
  let falhas = 0;

  for (const row of abandonadas) {
    try {
      await descartarInstanciaEvolutionAbandonada(db, env, row);
      descartadas += 1;
    } catch {
      falhas += 1;
    }
  }

  return { candidatas: abandonadas.length, descartadas, falhas };
}
