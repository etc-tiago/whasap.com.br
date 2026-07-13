import type { InstanciaItem } from "@/lib/orpc";

export type HistoricoSyncStatus = "idle" | "requested" | "running" | "completed" | "failed";

export function historicoSyncStatusDe(inst: InstanciaItem): HistoricoSyncStatus {
  const s = inst.evoHistoricoSyncStatus;
  if (s === "requested" || s === "running" || s === "completed" || s === "failed") return s;
  if (inst.evoHistoricoSincronizandoEm) {
    const age = Date.now() - new Date(inst.evoHistoricoSincronizandoEm).getTime();
    if (age < 30 * 60 * 1000) return "running";
  }
  if (inst.evoHistoricoSincronizadoEm) return "completed";
  return "idle";
}

export function historicoSyncEmAndamento(inst: InstanciaItem): boolean {
  const s = historicoSyncStatusDe(inst);
  return s === "requested" || s === "running";
}

/**
 * Copy de status. Não exibe % da fase atual: o provedor manda várias fases
 * (bootstrap → completo → recente), cada uma com progress 0→100 — mostrar %
 * enganaria (ex.: 100% no bootstrap com dezenas de milhares de msgs ainda por vir).
 */
export function rotuloHistoricoSync(inst: InstanciaItem): string {
  const s = historicoSyncStatusDe(inst);
  switch (s) {
    case "requested":
      return "Aguardando histórico…";
    case "running":
      return "Sincronizando histórico…";
    case "completed":
      return "Histórico sincronizado";
    case "failed":
      return "Falha na sincronização";
    default:
      return "Histórico não sincronizado";
  }
}
