/**
 * Critérios de organização conectada e operacional no painel.
 * Operacional = ao menos uma instância WhatsApp conectada (sem exigir assinatura).
 */
export function isOrganizacaoConectada(
  instancias: Array<{ status: string }>,
): boolean {
  return instancias.some((i) => i.status === "connected");
}

export type { IntegracaoStep as PassoIntegracao } from "./integracao/wizard-state";
export { resolverIntegracaoStep } from "./integracao/wizard-state";
