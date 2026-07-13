import type { instancia, instanciaEvo, instanciaMetaCloud } from "@whasap/db";

export type InstanciaComProvedor = Pick<
  typeof instancia.$inferSelect,
  | "id"
  | "uuid"
  | "organizacaoId"
  | "nome"
  | "icone"
  | "provedor"
  | "status"
  | "limiteConversas"
  | "asaasIdAssinatura"
  | "trialTerminaEm"
  | "conectadoEm"
  | "sessaoRemotaLiberadaEm"
  | "criadoEm"
  | "tentativasProvisionamento"
> & {
  evo?: Pick<
    typeof instanciaEvo.$inferSelect,
    | "nomeInstancia"
    | "instanceId"
    | "token"
    | "historicoSincronizadoEm"
    | "historicoSincronizandoEm"
    | "historicoSyncStatus"
    | "historicoSyncProgress"
    | "historicoSyncErro"
  > | null;
  metaCloud?: Pick<
    typeof instanciaMetaCloud.$inferSelect,
    "phoneNumberId" | "wabaId" | "accessToken"
  > | null;
};

export function evoDaInstancia(row: InstanciaComProvedor) {
  return row.evo ?? null;
}

export function metaCloudDaInstancia(row: InstanciaComProvedor) {
  return row.metaCloud ?? null;
}
