export const instanceProviders = ["cloud_api", "evolution"] as const;
export type InstanceProvider = (typeof instanceProviders)[number];

/** Instância Evolution GO (WhatsApp Comercial). */
export function isEvolutionProvider(provedor: string): provedor is "evolution" {
  return provedor === "evolution";
}
