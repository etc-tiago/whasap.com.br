export function toOrganizacaoOutput(org: {
  uuid: string;
  nome: string;
  slug: string;
  documentoFiscal: string | null;
  tipoDocumento: string | null;
  razaoSocial: string | null;
  asaasIdCliente: string | null;
}) {
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
  instance: {
    uuid: string;
    nome: string;
    provedor: "cloud_api" | "evolution";
    status:
      | "pending_connection"
      | "pending_payment"
      | "provisioning"
      | "disconnected"
      | "connected"
      | "deactivated";
    limiteConversas: number;
    asaasIdAssinatura: string | null;
    nuvemIdNumeroTelefone: string | null;
    trialTerminaEm: Date | null;
    conectadoEm: Date | null;
    criadoEm: Date;
  },
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
