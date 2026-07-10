import {
  isEvoProvider,
  isMetaCloudProvider,
  rotuloProvedor,
  type InstanceProvider,
} from "@whasap/config";

import { instanciaOperacional } from "@/lib/instancia-status";

export const INTEGRACAO_STEPS = [
  "escolher",
  "tipo",
  "evolution_qr",
  "evolution_sincronia",
  "cloud_config",
  "cloud_sincronia",
  "concluido",
] as const;

export type IntegracaoStep = (typeof INTEGRACAO_STEPS)[number];

export type CloudCredenciais = {
  phoneNumberId: string;
  wabaId: string;
  accessToken: string;
};

export function isIntegracaoStep(value: string): value is IntegracaoStep {
  return (INTEGRACAO_STEPS as readonly string[]).includes(value);
}

type ResolverStepParams = {
  searchStep: string;
  instanceId: string;
  modoNovo: boolean;
  temInstanciasParaReconectar: boolean;
  instancia?: { status: string; provider: string } | null;
};

/** Resolve passo do wizard: URL explícita com fallback seguro. */
export function resolverIntegracaoStep(params: ResolverStepParams): IntegracaoStep {
  const { searchStep, instanceId, modoNovo, temInstanciasParaReconectar, instancia: inst } =
    params;

  if (searchStep === "concluido" || (inst && instanciaOperacional(inst.status))) return "concluido";
  if (searchStep && isIntegracaoStep(searchStep)) return searchStep;

  if (!instanceId) {
    if (modoNovo || !temInstanciasParaReconectar) return "tipo";
    return "escolher";
  }

  if (inst && isEvoProvider(inst.provider)) {
    if (inst.status === "provisioning" || inst.status === "pending_connection") {
      return "evolution_qr";
    }
    if (inst.status === "disconnected") return "evolution_qr";
  }

  if (inst && isMetaCloudProvider(inst.provider)) {
    return "cloud_config";
  }

  return "tipo";
}

export function passoEvolutionQr(step: IntegracaoStep): boolean {
  return step === "evolution_qr";
}

export function subtituloIntegracao(
  passo: IntegracaoStep,
  provedor?: InstanceProvider,
): string {
  switch (passo) {
    case "escolher":
      return "Escolha qual WhatsApp reconectar ou adicione um novo";
    case "tipo":
      return "Passo 1 — escolha o tipo de conexão";
    case "evolution_qr":
      return "Passo 2 — escaneie o QR Code no WhatsApp";
    case "evolution_sincronia":
      return "Passo 3 — sincronizando sua conexão";
    case "cloud_config":
      return "Passo 2 — informe as credenciais da Meta";
    case "cloud_sincronia":
      return "Passo 3 — sincronizando modelos de mensagem";
    case "concluido":
      return "Pronto para começar";
    default:
      return provedor ? `Configurar ${rotuloProvedor(provedor)}` : "Configurar integração";
  }
}

export function progressoIntegracao(passo: IntegracaoStep): { current: number; total: number } {
  switch (passo) {
    case "escolher":
      return { current: 0, total: 4 };
    case "tipo":
      return { current: 0, total: 3 };
    case "evolution_qr":
    case "cloud_config":
      return { current: 1, total: 3 };
    case "evolution_sincronia":
    case "cloud_sincronia":
      return { current: 2, total: 3 };
    case "concluido":
      return { current: 3, total: 3 };
    default:
      return { current: 0, total: 3 };
  }
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
