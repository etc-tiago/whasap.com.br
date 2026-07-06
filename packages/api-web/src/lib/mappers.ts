import type {
  instances,
  organizations,
  usuario,
} from "@whasap/db";

export function toUsuarioOutput(u: typeof usuario.$inferSelect) {
  return {
    id: u.uuid,
    email: u.email,
    nome: u.nome,
    emailVerificadoEm: u.emailVerificadoEm?.toISOString() ?? null,
  };
}

export function toOrganizacaoOutput(org: typeof organizations.$inferSelect) {
  return {
    id: org.uuid,
    nome: org.name,
    slug: org.slug,
    documento: org.taxId,
    tipoDocumento: org.taxIdType,
    razaoSocial: org.legalName,
    asaasCustomerId: org.asaasCustomerId,
  };
}

export function toInstanciaOutput(
  instance: typeof instances.$inferSelect,
  organizacaoUuid: string,
) {
  return {
    id: instance.uuid,
    organizacaoId: organizacaoUuid,
    nome: instance.name,
    provider: instance.provider,
    status: instance.status,
    limiteConversas: instance.conversationLimit,
    asaasSubscriptionId: instance.asaasSubscriptionId,
    evolutionSecretName: instance.evolutionSecretName,
    cloudPhoneNumberId: instance.cloudPhoneNumberId,
    trialEndsAt: instance.trialEndsAt?.toISOString() ?? null,
    connectedAt: instance.connectedAt?.toISOString() ?? null,
    criadoEm: instance.criadoEm.toISOString(),
  };
}
