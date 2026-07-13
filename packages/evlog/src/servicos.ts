/** Nomes de serviço nos wide events (alinhados aos workers Wrangler). */
export const SERVICOS = {
  web: "whasap-web",
  office: "whasap-office",
  site: "whasap-site",
  webhook: "whasap-webhook",
  cdn: "whasap-cdn",
  evolutionCleanup: "whasap-evolution-cleanup",
  historySync: "whasap-history-sync",
} as const;

export type ServicoEvlog = keyof typeof SERVICOS;
