import type { InstanceProvider } from "./providers";

/** Rótulos de provedor para exibição ao usuário (UI, marketing). */
export const rotuloProvedorInstancia: Record<InstanceProvider, string> = {
  evolution: "WhatsApp Comercial (business)",
  cloud_api: "WhatsApp Cloud API",
};

const rotuloWhatsAppTipo: Record<InstanceProvider, string> = {
  evolution: "WhatsApp Business",
  cloud_api: "WhatsApp Cloud",
};

const rotuloSeuWhatsAppTipo: Record<InstanceProvider, string> = {
  evolution: "seu WhatsApp Business",
  cloud_api: "seu WhatsApp Cloud",
};

/** Retorna o rótulo amigável do provedor para interfaces do produto. */
export function rotuloProvedor(provedor: InstanceProvider): string {
  return rotuloProvedorInstancia[provedor];
}

/** Tipo de WhatsApp para copy do produto (`WhatsApp Business` / `WhatsApp Cloud`). */
export function rotuloWhatsApp(provedor: InstanceProvider): string {
  return rotuloWhatsAppTipo[provedor];
}

/** Referência possessiva para copy do produto (`seu WhatsApp Business` / `seu WhatsApp Cloud`). */
export function rotuloSeuWhatsApp(provedor: InstanceProvider): string {
  return rotuloSeuWhatsAppTipo[provedor];
}
