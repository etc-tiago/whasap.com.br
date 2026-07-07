/**
 * Critérios de organização operacional no painel.
 * Uma org é operacional quando tem ao menos uma instância conectada com assinatura Asaas ativa.
 */
export function isOrganizacaoOperacional(
  instancias: Array<{ status: string; asaasSubscriptionId: string | null }>,
): boolean {
  return instancias.some((i) => i.status === "connected" && i.asaasSubscriptionId);
}

export type PassoOnboarding = "tipo" | "conexao" | "trial" | "pagamento" | "concluido";

type DerivarPassoParams = {
  searchStep: string;
  activeInstanceId: string;
  instancia?: {
    status: string;
    provider: string;
  } | null;
};

/**
 * Deriva o passo atual do wizard de onboarding a partir do status da instância e query params.
 *
 * Fluxo: tipo → conexao → trial → pagamento → concluido
 * - `tipo`: sem instância selecionada
 * - `conexao`: provisionamento/QR ou config Cloud API
 * - `trial`/`pagamento`: instância em `pending_payment`
 * - `concluido`: `connected` ou `?step=concluido`
 */
export function derivarPassoOnboarding(params: DerivarPassoParams): PassoOnboarding {
  const { searchStep, activeInstanceId, instancia: inst } = params;

  if (searchStep === "concluido" || inst?.status === "connected") return "concluido";
  if (!activeInstanceId) return "tipo";
  if (inst?.status === "pending_payment") {
    if (searchStep === "pagamento") return "pagamento";
    return "trial";
  }
  return "conexao";
}
