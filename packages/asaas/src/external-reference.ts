export type AsaasExternalReference =
  | { type: "org"; organizacaoUuid: string }
  | { type: "instance"; instanceUuid: string }
  | { type: "pack"; instanceUuid: string };

export function parseAsaasExternalReference(
  value: string | null | undefined,
): AsaasExternalReference | null {
  if (!value) return null;
  if (value.startsWith("org:")) {
    return { type: "org", organizacaoUuid: value.slice("org:".length) };
  }
  if (value.startsWith("instance:")) {
    return { type: "instance", instanceUuid: value.slice("instance:".length) };
  }
  if (value.startsWith("pack:")) {
    return { type: "pack", instanceUuid: value.slice("pack:".length) };
  }
  return null;
}
