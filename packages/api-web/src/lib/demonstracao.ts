import { preconditionFailed, marcarInstanciaConectadaEvolution, solicitarHistoricoSyncSePrimeiraConexao } from "@whasap/api-core";
import { isEvoProvider, mvpDefaults } from "@whasap/config";
import {
  colunasOrganizacaoPublica,
  comTimestampAtualizacao,
  instancia,
  organizacao,
} from "@whasap/db";
import { and, eq, isNull } from "drizzle-orm";

import type { WebContext } from "../types";

export type EstadoDemonstracao = "livre" | "aviso" | "bloqueado" | "pago";

export type DemonstracaoInfo = {
  estado: EstadoDemonstracao;
  diasRestantes: number | null;
  demonstracaoIniciaEm: string | null;
};

const FUSO_DEMONSTRACAO = "America/Sao_Paulo";
const DIAS_DEMONSTRACAO = mvpDefaults.billing.trialDays;

type InstanciaAssinatura = { asaasIdAssinatura: string | null };
type OrgDemonstracao = {
  demonstracaoIniciaEm: Date | null;
  asaasIdAssinaturaBase?: string | null;
};

/** Formata data no fuso de São Paulo (YYYY-MM-DD). */
function formatarDataSaoPaulo(data: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: FUSO_DEMONSTRACAO,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(data);
}

/**
 * Dia corrido da demonstração (1 = dia da 1ª conexão), fuso America/Sao_Paulo.
 */
export function diaDemonstracao(iniciaEm: Date, agora = new Date()): number {
  const inicioStr = formatarDataSaoPaulo(iniciaEm);
  const agoraStr = formatarDataSaoPaulo(agora);
  const inicioMs = Date.parse(`${inicioStr}T12:00:00`);
  const agoraMs = Date.parse(`${agoraStr}T12:00:00`);
  return Math.floor((agoraMs - inicioMs) / 86_400_000) + 1;
}

/** Org tem taxa base ativa ou ao menos uma conexão com assinatura Asaas. */
export function orgTemAssinaturaAtiva(
  instancias: InstanciaAssinatura[],
  org?: Pick<OrgDemonstracao, "asaasIdAssinaturaBase"> | null,
): boolean {
  if (org?.asaasIdAssinaturaBase) return true;
  return instancias.some((i) => i.asaasIdAssinatura !== null);
}

/**
 * Deriva estado da demonstração (3 dias gratuitos por org, calendário SP).
 * - Dia 1: livre · Dias 2–3: aviso · Dia 4+: bloqueado · Com assinatura: pago
 */
export function derivarEstadoDemonstracao(
  org: OrgDemonstracao,
  instancias: InstanciaAssinatura[],
): DemonstracaoInfo {
  if (orgTemAssinaturaAtiva(instancias, org)) {
    return { estado: "pago", diasRestantes: null, demonstracaoIniciaEm: null };
  }

  if (!org.demonstracaoIniciaEm) {
    return { estado: "livre", diasRestantes: null, demonstracaoIniciaEm: null };
  }

  const iniciaEmIso = org.demonstracaoIniciaEm.toISOString();
  const dia = diaDemonstracao(org.demonstracaoIniciaEm);

  if (dia <= 1) {
    return { estado: "livre", diasRestantes: null, demonstracaoIniciaEm: iniciaEmIso };
  }

  if (dia === 2) {
    return { estado: "aviso", diasRestantes: 2, demonstracaoIniciaEm: iniciaEmIso };
  }

  if (dia === 3) {
    return { estado: "aviso", diasRestantes: 1, demonstracaoIniciaEm: iniciaEmIso };
  }

  return { estado: "bloqueado", diasRestantes: 0, demonstracaoIniciaEm: iniciaEmIso };
}

/** Dias de trial Asaas alinhados aos dias restantes da demonstração (mín. 0). */
export function diasTrialAsaasRestantes(org: OrgDemonstracao): number {
  if (!org.demonstracaoIniciaEm) return DIAS_DEMONSTRACAO;
  const dia = diaDemonstracao(org.demonstracaoIniciaEm);
  return Math.max(0, DIAS_DEMONSTRACAO + 1 - dia);
}

/** Define `demonstracaoIniciaEm` na org se ainda não iniciou. */
export async function iniciarDemonstracaoSeNecessario(
  ctx: WebContext,
  orgIdInterno: number,
): Promise<void> {
  const org = await ctx.db.query.organizacao.findFirst({
    where: and(eq(organizacao.id, orgIdInterno), isNull(organizacao.excluidoEm)),
    columns: { id: true, demonstracaoIniciaEm: true },
  });
  if (!org || org.demonstracaoIniciaEm) return;

  await ctx.db
    .update(organizacao)
    .set(comTimestampAtualizacao({ demonstracaoIniciaEm: new Date() }))
    .where(eq(organizacao.id, orgIdInterno));
}

/** Marca instância como conectada e inicia demonstração da org na 1ª conexão. */
export async function marcarInstanciaConectada(
  ctx: WebContext,
  instanciaIdInterno: number,
  orgIdInterno: number,
  asaasIdAssinatura?: string | null,
): Promise<void> {
  await marcarInstanciaConectadaEvolution(ctx.db, {
    instanciaIdInterno,
    orgIdInterno,
    asaasIdAssinatura,
  });

  const row = await ctx.db.query.instancia.findFirst({
    where: eq(instancia.id, instanciaIdInterno),
    columns: { uuid: true, provedor: true },
  });
  if (row && isEvoProvider(row.provedor)) {
    try {
      await solicitarHistoricoSyncSePrimeiraConexao(
        ctx.db,
        ctx.env,
        instanciaIdInterno,
        row.uuid,
      );
    } catch {
      // Sync automático não bloqueia a conexão.
    }
  }
}

async function carregarDemonstracaoOrg(
  ctx: WebContext,
  orgIdInterno: number,
): Promise<DemonstracaoInfo> {
  const org = await ctx.db.query.organizacao.findFirst({
    where: and(eq(organizacao.id, orgIdInterno), isNull(organizacao.excluidoEm)),
    columns: colunasOrganizacaoPublica,
  });
  if (!org) return { estado: "livre", diasRestantes: null, demonstracaoIniciaEm: null };

  const instancias = await ctx.db.query.instancia.findMany({
    where: and(eq(instancia.organizacaoId, orgIdInterno), isNull(instancia.excluidoEm)),
    columns: { asaasIdAssinatura: true },
  });

  return derivarEstadoDemonstracao(org, instancias);
}

/**
 * Bloqueia mutações e leituras sensíveis quando demonstração expirou sem pagamento.
 * @throws 412 se estado `bloqueado`
 */
export async function exigirAcessoDemonstracao(
  ctx: WebContext,
  orgIdInterno: number,
): Promise<void> {
  const demo = await carregarDemonstracaoOrg(ctx, orgIdInterno);
  if (demo.estado === "bloqueado") {
    preconditionFailed(
      "O período de demonstração terminou. Configure o pagamento para continuar usando o Whasap.",
    );
  }
}

/** Carrega estado de demonstração para resposta ORPC (por uuid da org). */
export async function obterDemonstracaoPorHash(
  ctx: WebContext,
  organizacaoHash: string,
): Promise<DemonstracaoInfo> {
  const org = await ctx.db.query.organizacao.findFirst({
    where: and(eq(organizacao.uuid, organizacaoHash), isNull(organizacao.excluidoEm)),
    columns: colunasOrganizacaoPublica,
  });
  if (!org) return { estado: "livre", diasRestantes: null, demonstracaoIniciaEm: null };

  const instancias = await ctx.db.query.instancia.findMany({
    where: and(eq(instancia.organizacaoId, org.id), isNull(instancia.excluidoEm)),
    columns: { asaasIdAssinatura: true },
  });

  return derivarEstadoDemonstracao(org, instancias);
}
