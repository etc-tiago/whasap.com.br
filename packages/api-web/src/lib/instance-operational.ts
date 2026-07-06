import type { instances } from "@whasap/db";

type InstanceRow = Pick<
  typeof instances.$inferSelect,
  "status" | "asaasSubscriptionId" | "trialEndsAt"
>;

/** Instância pronta para uso no painel (conectada + assinatura ativa). */
export function isInstanceOperational(instance: InstanceRow): boolean {
  return instance.status === "connected" && instance.asaasSubscriptionId !== null;
}

export function isOrgOnboardingComplete(
  instances: InstanceRow[],
): boolean {
  return instances.some(isInstanceOperational);
}

export function trialDaysRemaining(trialEndsAt: Date | null): number | null {
  if (!trialEndsAt) return null;
  const ms = trialEndsAt.getTime() - Date.now();
  if (ms <= 0) return 0;
  return Math.ceil(ms / (24 * 60 * 60 * 1000));
}
