import type { InstanceProvider } from "./providers";

/** Rótulos de provedor para exibição ao usuário (UI, marketing). */
export const rotuloProvedorInstancia: Record<InstanceProvider, string> = {
  evolution: "WhatsApp Comercial (business)",
  cloud_api: "WhatsApp Cloud API",
};

/** Retorna o rótulo amigável do provedor para interfaces do produto. */
export function rotuloProvedor(provedor: InstanceProvider): string {
  return rotuloProvedorInstancia[provedor];
}
