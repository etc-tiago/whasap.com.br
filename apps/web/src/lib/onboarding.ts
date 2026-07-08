/**
 * Critérios de organização conectada e operacional no painel.
 * Operacional = ao menos uma instância WhatsApp conectada (sem exigir assinatura).
 */
export function isOrganizacaoConectada(
  instancias: Array<{ status: string }>,
): boolean {
  return instancias.some((i) => i.status === "connected");
}

export type PassoOnboarding = "tipo" | "conexao" | "concluido";

type DerivarPassoParams = {
  searchStep: string;
  activeInstanceId: string;
  instancia?: {
    status: string;
    provider: string;
  } | null;
};

/**
 * Deriva o passo atual do wizard de onboarding a partir do status da instância.
 * Fluxo: tipo → conexao → concluido
 */
export function derivarPassoOnboarding(params: DerivarPassoParams): PassoOnboarding {
  const { searchStep, activeInstanceId, instancia: inst } = params;

  if (searchStep === "concluido" || inst?.status === "connected") return "concluido";
  if (!activeInstanceId) return "tipo";
  return "conexao";
}
