export const instanceProviders = ["meta_cloud", "evo"] as const;
export type InstanceProvider = (typeof instanceProviders)[number];

/** Instância Evolution GO (WhatsApp Comercial). */
export function isEvoProvider(provedor: string): provedor is "evo" {
  return provedor === "evo";
}

/** Instância Meta WhatsApp Cloud API. */
export function isMetaCloudProvider(provedor: string): provedor is "meta_cloud" {
  return provedor === "meta_cloud";
}

/** @deprecated use isEvoProvider */
export const isEvolutionProvider = isEvoProvider;
