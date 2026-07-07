import type { instancia } from "@whasap/db";

type InstanceRow = Pick<
  typeof instancia.$inferSelect,
  "status" | "asaasIdAssinatura" | "trialTerminaEm"
>;

/** Instância pronta para uso no painel (conectada + assinatura ativa). */
export function isInstanceOperational(instance: InstanceRow): boolean {
  return instance.status === "connected" && instance.asaasIdAssinatura !== null;
}

export function isOrgOnboardingComplete(instances: InstanceRow[]): boolean {
  return instances.some(isInstanceOperational);
}

export function trialDaysRemaining(trialTerminaEm: Date | null): number | null {
  if (!trialTerminaEm) return null;
  const ms = trialTerminaEm.getTime() - Date.now();
  if (ms <= 0) return 0;
  return Math.ceil(ms / (24 * 60 * 60 * 1000));
}
