/**
 * Critérios de organização conectada e operacional no painel.
 * Operacional = ao menos uma instância WhatsApp conectada (sem exigir assinatura).
 */
export function isOrganizacaoConectada(
  instancias: Array<{ status: string }>,
): boolean {
  return instancias.some((i) => i.status === "connected");
}

export type PassoOnboarding = "escolher" | "tipo" | "conexao" | "concluido";

type DerivarPassoParams = {
  searchStep: string;
  activeInstanceId: string;
  modoNovo: boolean;
  temInstanciasParaReconectar: boolean;
  instancia?: {
    status: string;
    provider: string;
  } | null;
};

/**
 * Deriva o passo atual do wizard de onboarding a partir do status da instância.
 * Fluxo: escolher → conexao → concluido (ou tipo ao criar nova instância)
 */
export function derivarPassoOnboarding(params: DerivarPassoParams): PassoOnboarding {
  const { searchStep, activeInstanceId, modoNovo, temInstanciasParaReconectar, instancia: inst } =
    params;

  if (searchStep === "concluido" || inst?.status === "connected") return "concluido";
  if (!activeInstanceId) {
    if (modoNovo || !temInstanciasParaReconectar) return "tipo";
    return "escolher";
  }
  return "conexao";
}
