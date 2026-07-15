/**
 * Solicita sync de histórico Evolution GO e marca status na instancia_evo.
 * Sync on-demand por conversa não altera o status da instância.
 */
import { jidDeContato, parseGoConnectionState } from "@whasap/evolution";
import { log } from "@whasap/evlog";
import {
  colunasContatoInstancia,
  colunasInstanciaEvo,
  colunasMensagemLista,
  comTimestampAtualizacao,
  contatoInstancia,
  type Db,
  instanciaEvo,
  mensagem,
} from "@whasap/db";
import { and, asc, eq, isNotNull, isNull } from "drizzle-orm";

import { criarClienteEvolutionGo, type EvolutionGoEnv } from "./criar-cliente-evolution-go";
import { getEvolutionCredentials, type EvolutionSecretsEnv } from "./evolution-env";

/** Mensagem amigável quando a Evolution GO falha ao iniciar o history sync. */
export function motivoFalhaHistorySync(
  err: unknown,
  opts?: { jaSincronizouAntes?: boolean },
): string {
  const msg = err instanceof Error ? err.message : String(err);
  const match = msg.match(/Evolution GO error \((\d+)\)/);
  const status = match ? Number(match[1]) : undefined;
  if (status === 500 || status === 502 || status === 503) {
    if (opts?.jaSincronizouAntes) {
      return "O WhatsApp recusou uma nova sincronização completa agora (já houve sync recente neste aparelho). Aguarde alguns minutos ou confira se as conversas já apareceram no inbox.";
    }
    return "O WhatsApp não conseguiu iniciar a sincronização agora. Confirme que a sessão está conectada e tente de novo em alguns minutos.";
  }
  if (status === 404) {
    return "Instância não encontrada no provedor. Reconecte o WhatsApp e tente de novo.";
  }
  if (status === 401 || status === 403) {
    return "Sessão do WhatsApp inválida. Reconecte a instância e tente de novo.";
  }
  return "Não foi possível iniciar a sincronização do histórico. Tente novamente.";
}

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

export type ParamsHistoricoSyncConversa = {
  instanciaId: number;
  instanciaUuid: string;
  evoToken: string;
  conversaIdInterno: number;
  contatoId: number;
  telefone: string | null;
  count?: number;
};

const LOCK_MS = 30 * 60 * 1000;
const COUNT_ON_DEMAND_PADRAO = 100;

export function historicoSyncEmAndamento(
  evo: { historicoSincronizandoEm: Date | null; historicoSyncStatus?: string | null } | null,
): boolean {
  if (!evo) return false;
  if (evo.historicoSyncStatus !== "requested" && evo.historicoSyncStatus !== "running") {
    return false;
  }
  if (!evo.historicoSincronizandoEm) return true;
  return Date.now() - evo.historicoSincronizandoEm.getTime() < LOCK_MS;
}

/**
 * Dispara `historySync` na Evolution e marca `requested`.
 * @returns false se já em andamento, sessão offline ou sem token.
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

  const jaSincronizouAntes = Boolean(
    instancia.evo.historicoSincronizadoEm ||
    instancia.evo.historicoSyncStatus === "completed" ||
    instancia.evo.historicoSyncStatus === "failed" ||
    instancia.evo.historicoSyncStatus === "running",
  );

  const creds = await getEvolutionCredentials(env);
  const client = criarClienteEvolutionGo(
    env,
    creds,
    { instanceToken: instancia.evo.token },
    { instanciaUuid: instancia.uuid },
  );

  try {
    const statusBruto = await client.getStatus();
    if (parseGoConnectionState(statusBruto) !== "open") {
      return {
        ok: false,
        motivo:
          "A sessão do WhatsApp ainda não está totalmente conectada (LoggedIn). Aguarde a conexão estabilizar e tente de novo.",
      };
    }
  } catch (err) {
    log.warn({
      contexto: "historico_sync.preflight_status",
      instanciaUuid: instancia.uuid,
      erro: err instanceof Error ? err.message : String(err),
    });
    return {
      ok: false,
      motivo: "Não foi possível verificar a conexão do WhatsApp. Tente novamente em instantes.",
    };
  }

  try {
    await client.historySync({ count: opts?.count ?? 5000 });
  } catch (err) {
    log.error({
      contexto: "historico_sync.solicitar",
      instanciaUuid: instancia.uuid,
      erro: err instanceof Error ? err.message : String(err),
      jaSincronizouAntes,
    });
    return { ok: false, motivo: motivoFalhaHistorySync(err, { jaSincronizouAntes }) };
  }

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

/**
 * Dispara HistorySync on-demand de uma conversa via `messageInfo`.
 * Não altera `historicoSyncStatus` da instância (independente do sync completo).
 * @returns false se sem token, sem JID ou sem mensagem âncora com idExterno.
 */
export async function solicitarHistoricoSyncConversaEvolution(
  db: Db,
  env: EnvSolicitarHistorico,
  params: ParamsHistoricoSyncConversa,
): Promise<{ ok: boolean; motivo?: string }> {
  const vinculo = await db.query.contatoInstancia.findFirst({
    where: and(
      eq(contatoInstancia.contatoId, params.contatoId),
      eq(contatoInstancia.instanciaId, params.instanciaId),
    ),
    columns: colunasContatoInstancia,
  });

  const chatJid = jidDeContato(params.telefone ?? "", vinculo?.idExterno);
  if (!chatJid.includes("@")) {
    return { ok: false, motivo: "Contato sem identificador WhatsApp" };
  }

  const ancora = await db.query.mensagem.findFirst({
    where: and(
      eq(mensagem.conversaId, params.conversaIdInterno),
      isNull(mensagem.excluidoEm),
      isNotNull(mensagem.idExterno),
    ),
    columns: colunasMensagemLista,
    orderBy: [asc(mensagem.enviadoEm)],
  });
  if (!ancora?.idExterno) {
    return {
      ok: false,
      motivo: "Envie ou receba ao menos uma mensagem nesta conversa",
    };
  }

  const creds = await getEvolutionCredentials(env);
  const client = criarClienteEvolutionGo(
    env,
    creds,
    { instanceToken: params.evoToken },
    { instanciaUuid: params.instanciaUuid, origem: "historico_sync_conversa" },
  );

  try {
    await client.historySync({
      count: params.count ?? COUNT_ON_DEMAND_PADRAO,
      messageInfo: {
        chat: chatJid,
        id: ancora.idExterno,
        isFromMe: ancora.direcao === "outbound",
        timestamp: ancora.enviadoEm.toISOString(),
      },
    });
  } catch (err) {
    log.error({
      contexto: "historico_sync.solicitar_conversa",
      instanciaUuid: params.instanciaUuid,
      erro: err instanceof Error ? err.message : String(err),
    });
    return { ok: false, motivo: motivoFalhaHistorySync(err) };
  }

  return { ok: true };
}
