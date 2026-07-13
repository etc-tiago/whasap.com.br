/**
 * Critérios de organização conectada e operacional no painel.
 */
export function isOrganizacaoConectada(instancias: Array<{ status: string }>): boolean {
  return instancias.some((i) => i.status === "connected");
}

export type { IntegracaoStep as PassoIntegracao } from "./integracao/wizard-state";
export { resolverIntegracaoStep } from "./integracao/wizard-state";
