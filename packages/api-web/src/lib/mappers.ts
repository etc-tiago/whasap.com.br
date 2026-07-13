import type { organizacao, usuario } from "@whasap/db";
import { ICONE_CONEXAO_PADRAO, isIconeConexao, type IconeConexao } from "@whasap/config";

import type { InstanciaComProvedor } from "./instancia-provedor";

export function toUsuarioOutput(
  u: Pick<typeof usuario.$inferSelect, "uuid" | "email" | "nome" | "emailVerificadoEm">,
) {
  return {
    id: u.uuid,
    email: u.email,
    nome: u.nome,
    emailVerificadoEm: u.emailVerificadoEm?.toISOString() ?? null,
  };
}

export function toOrganizacaoOutput(
  org: Pick<
    typeof organizacao.$inferSelect,
    | "uuid"
    | "nome"
    | "slug"
    | "documentoFiscal"
    | "tipoDocumento"
    | "razaoSocial"
    | "asaasIdCliente"
  >,
) {
  return {
    id: org.uuid,
    nome: org.nome,
    slug: org.slug,
    documento: org.documentoFiscal,
    tipoDocumento: org.tipoDocumento,
    razaoSocial: org.razaoSocial,
    asaasCustomerId: org.asaasIdCliente,
  };
}

function resolverIconeConexao(icone: string | null | undefined): IconeConexao {
  if (icone && isIconeConexao(icone)) return icone;
  return ICONE_CONEXAO_PADRAO;
}

function resolverHistoricoSyncStatus(
  status: string | null | undefined,
): "idle" | "requested" | "running" | "completed" | "failed" {
  if (
    status === "requested" ||
    status === "running" ||
    status === "completed" ||
    status === "failed"
  ) {
    return status;
  }
  return "idle";
}

export function toInstanciaOutput(instance: InstanciaComProvedor, organizacaoUuid: string) {
  return {
    id: instance.uuid,
    organizacaoId: organizacaoUuid,
    nome: instance.nome,
    icone: resolverIconeConexao(instance.icone),
    provider: instance.provedor,
    status: instance.status,
    limiteConversas: instance.limiteConversas,
    asaasSubscriptionId: instance.asaasIdAssinatura,
    cloudPhoneNumberId: instance.metaCloud?.phoneNumberId ?? null,
    trialEndsAt: instance.trialTerminaEm?.toISOString() ?? null,
    connectedAt: instance.conectadoEm?.toISOString() ?? null,
    criadoEm: instance.criadoEm.toISOString(),
    evoHistoricoSincronizadoEm: instance.evo?.historicoSincronizadoEm?.toISOString() ?? null,
    evoHistoricoSincronizandoEm: instance.evo?.historicoSincronizandoEm?.toISOString() ?? null,
    evoHistoricoSyncStatus: resolverHistoricoSyncStatus(instance.evo?.historicoSyncStatus),
    evoHistoricoSyncProgress: instance.evo?.historicoSyncProgress ?? null,
    evoHistoricoSyncErro: instance.evo?.historicoSyncErro ?? null,
  };
}
