export function toOrganizacaoOutput(org: {
  uuid: string;
  name: string;
  slug: string;
  taxId: string | null;
  taxIdType: string | null;
  legalName: string | null;
  asaasCustomerId: string | null;
}) {
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
  instance: {
    uuid: string;
    name: string;
    provider: "cloud_api" | "evolution";
    status:
      | "pending_connection"
      | "pending_payment"
      | "provisioning"
      | "disconnected"
      | "connected"
      | "deactivated";
    conversationLimit: number;
    asaasSubscriptionId: string | null;
    evolutionSecretName: string | null;
    cloudPhoneNumberId: string | null;
    trialEndsAt: Date | null;
    connectedAt: Date | null;
    criadoEm: Date;
  },
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
