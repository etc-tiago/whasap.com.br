type InstanceRow = {
  status: string;
};

/** Instância pronta para uso no painel. */
export function isInstanceOperational(instance: InstanceRow): boolean {
  return instance.status === "connected";
}

export function isOrgOnboardingComplete(instances: InstanceRow[]): boolean {
  return instances.some(isInstanceOperational);
}
