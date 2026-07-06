/** Cast create input — timestamps plugin fills `criadoEm` / `atualizadoEm` at runtime. */
// biome-ignore lint/suspicious/noExplicitAny: bridges drizzle insert types with plugin-managed columns
export function appCreateData(data: object): any {
  return data;
}
