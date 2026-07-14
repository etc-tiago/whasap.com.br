import {
  ICONE_CONEXAO_PADRAO,
  isIconeConexao,
  type IconeConexao,
  type InstanceProvider,
} from "@whasap/config";

/**
 * Converte linha de organização do banco para o formato público da API.
 * O uuid interno vira `id` na resposta.
 */
export function mapearOrganizacaoParaSaida(org: {
  uuid: string;
  nome: string;
  slug: string;
  documentoFiscal: string | null;
  tipoDocumento: string | null;
  razaoSocial: string | null;
  telefoneWhatsapp: string | null;
  aceiteAdesaoEm: Date | null;
  aceiteAdesaoVersao: string | null;
  horasAutoFecharInatividade?: string | null;
  exibirNomeAtendenteMensagens?: boolean | null;
}) {
  return {
    id: org.uuid,
    nome: org.nome,
    slug: org.slug,
    documento: org.documentoFiscal,
    tipoDocumento: org.tipoDocumento,
    razaoSocial: org.razaoSocial,
    telefoneWhatsapp: org.telefoneWhatsapp,
    aceiteAdesaoEm: org.aceiteAdesaoEm?.toISOString() ?? null,
    aceiteAdesaoVersao: org.aceiteAdesaoVersao,
    horasAutoFecharInatividade: org.horasAutoFecharInatividade ?? "72",
    exibirNomeAtendenteMensagens: org.exibirNomeAtendenteMensagens ?? false,
  };
}

function resolverIcone(icone: string | null | undefined): IconeConexao {
  if (icone && isIconeConexao(icone)) return icone;
  return ICONE_CONEXAO_PADRAO;
}

/**
 * Converte linha de instância do banco para o formato público da API.
 * Requer o uuid da organização para preencher `organizacaoId`.
 */
export function mapearInstanciaParaSaida(
  instance: {
    uuid: string;
    nome: string;
    icone?: string | null;
    provedor: InstanceProvider;
    status:
      | "pending_connection"
      | "pending_payment"
      | "provisioning"
      | "disconnected"
      | "connected"
      | "deactivated";
    limiteConversas: number;
    conectadoEm: Date | null;
    sessaoRemotaLiberadaEm: Date | null;
    criadoEm: Date;
    evo?: {
      historicoSincronizadoEm: Date | null;
      historicoSincronizandoEm: Date | null;
      historicoSyncStatus?: string | null;
      historicoSyncProgress?: number | null;
      historicoSyncErro?: string | null;
    } | null;
    metaCloud?: {
      phoneNumberId: string | null;
    } | null;
  },
  organizacaoUuid: string,
) {
  const statusRaw = instance.evo?.historicoSyncStatus;
  const evoHistoricoSyncStatus: "idle" | "requested" | "running" | "completed" | "failed" =
    statusRaw === "requested" ||
    statusRaw === "running" ||
    statusRaw === "completed" ||
    statusRaw === "failed"
      ? statusRaw
      : "idle";

  return {
    id: instance.uuid,
    organizacaoId: organizacaoUuid,
    nome: instance.nome,
    icone: resolverIcone(instance.icone),
    provider: instance.provedor,
    status: instance.status,
    limiteConversas: instance.limiteConversas,
    cloudPhoneNumberId: instance.metaCloud?.phoneNumberId ?? null,
    connectedAt: instance.conectadoEm?.toISOString() ?? null,
    sessaoRemotaLiberadaEm: instance.sessaoRemotaLiberadaEm?.toISOString() ?? null,
    criadoEm: instance.criadoEm.toISOString(),
    evoHistoricoSincronizadoEm: instance.evo?.historicoSincronizadoEm?.toISOString() ?? null,
    evoHistoricoSincronizandoEm: instance.evo?.historicoSincronizandoEm?.toISOString() ?? null,
    evoHistoricoSyncStatus,
    evoHistoricoSyncProgress: instance.evo?.historicoSyncProgress ?? null,
    evoHistoricoSyncErro: instance.evo?.historicoSyncErro ?? null,
  };
}
