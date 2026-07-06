import { createAsaasClient } from "@whasap/asaas";
import { mvpDefaults } from "@whasap/config";
import type { organizations } from "@whasap/db";

export type AsaasEnv = {
  ASAAS_API_KEY: string;
  ASAAS_SANDBOX?: string;
};

function isSandbox(env: AsaasEnv): boolean {
  return env.ASAAS_SANDBOX === "true";
}

export function createAsaasFromEnv(env: AsaasEnv) {
  return createAsaasClient({
    apiKey: env.ASAAS_API_KEY,
    sandbox: isSandbox(env),
  });
}

export async function ensureAsaasCustomer(
  env: AsaasEnv,
  org: typeof organizations.$inferSelect & {
    taxId?: string | null;
    legalName?: string | null;
  },
): Promise<string> {
  if (org.asaasCustomerId) return org.asaasCustomerId;
  const asaas = createAsaasFromEnv(env);
  const customer = await asaas.customers.create({
    name: org.legalName ?? org.name,
    cpfCnpj: org.taxId ?? "",
  });
  return customer.id;
}

export async function createInstanceCheckout(params: {
  env: AsaasEnv;
  customerId: string;
  customerData: { name: string; cpfCnpj: string; email?: string };
  instanceUuid: string;
  instanceName: string;
  successUrl: string;
  cancelUrl: string;
  expiredUrl: string;
}): Promise<string> {
  const asaas = createAsaasFromEnv(params.env);
  const checkout = await asaas.checkouts.createInstanceCheckout({
    customerId: params.customerId,
    customerData: params.customerData,
    instanceUuid: params.instanceUuid,
    instanceName: params.instanceName,
    successUrl: params.successUrl,
    cancelUrl: params.cancelUrl,
    expiredUrl: params.expiredUrl,
    trialDays: mvpDefaults.billing.trialDays,
  });
  if (!checkout.link) throw new Error("Asaas checkout URL missing");
  return checkout.link;
}

export async function createConversationPackCheckout(params: {
  env: AsaasEnv;
  customerId: string;
  customerData: { name: string; cpfCnpj: string; email?: string };
  instanceUuid: string;
  successUrl: string;
  cancelUrl: string;
  expiredUrl: string;
}): Promise<string> {
  const asaas = createAsaasFromEnv(params.env);
  const checkout = await asaas.checkouts.createConversationPackCheckout({
    customerId: params.customerId,
    customerData: params.customerData,
    instanceUuid: params.instanceUuid,
    successUrl: params.successUrl,
    cancelUrl: params.cancelUrl,
    expiredUrl: params.expiredUrl,
  });
  if (!checkout.link) throw new Error("Asaas checkout URL missing");
  return checkout.link;
}

export { mvpDefaults };
