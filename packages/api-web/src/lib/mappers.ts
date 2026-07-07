import type { instancia, organizacao, usuario } from "@whasap/db";

export function toUsuarioOutput(u: typeof usuario.$inferSelect) {
  return {
    id: u.uuid,
    email: u.email,
    nome: u.nome,
    emailVerificadoEm: u.emailVerificadoEm?.toISOString() ?? null,
  };
}

export function toOrganizacaoOutput(org: typeof organizacao.$inferSelect) {
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

export function toInstanciaOutput(
  instance: typeof instancia.$inferSelect,
  organizacaoUuid: string,
) {
  return {
    id: instance.uuid,
    organizacaoId: organizacaoUuid,
    nome: instance.nome,
    provider: instance.provedor,
    status: instance.status,
    limiteConversas: instance.limiteConversas,
    asaasSubscriptionId: instance.asaasIdAssinatura,
    cloudPhoneNumberId: instance.nuvemIdNumeroTelefone,
    trialEndsAt: instance.trialTerminaEm?.toISOString() ?? null,
    connectedAt: instance.conectadoEm?.toISOString() ?? null,
    criadoEm: instance.criadoEm.toISOString(),
  };
}
