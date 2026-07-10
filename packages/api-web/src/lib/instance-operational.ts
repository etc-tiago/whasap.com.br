type InstanceRow = {
  status: string;
  asaasIdAssinatura: string | null;
};

/** Instância pronta para uso no painel. `pending_payment` = pareada sem assinatura (demo). */
export function isInstanceOperational(instance: InstanceRow): boolean {
  return instance.status === "connected" || instance.status === "pending_payment";
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
