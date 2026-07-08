import { createAsaasClient } from "@whasap/asaas";
import { getAsaasApiKey, isAsaasSandbox, type AsaasSecretsEnv } from "@whasap/api-core";
import { mvpDefaults } from "@whasap/config";
import type { organizacao } from "@whasap/db";

export type AsaasEnv = AsaasSecretsEnv;

export async function createAsaasFromEnv(env: AsaasEnv) {
  return createAsaasClient({
    apiKey: await getAsaasApiKey(env),
    sandbox: isAsaasSandbox(env),
  });
}

export async function ensureAsaasCustomer(
  env: AsaasEnv,
  org: Pick<
    typeof organizacao.$inferSelect,
    "asaasIdCliente" | "razaoSocial" | "nome" | "documentoFiscal"
  >,
): Promise<string> {
  if (org.asaasIdCliente) return org.asaasIdCliente;
  const asaas = await createAsaasFromEnv(env);
  const customer = await asaas.customers.create({
    name: org.razaoSocial ?? org.nome,
    cpfCnpj: org.documentoFiscal ?? "",
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
  trialDays?: number;
}): Promise<string> {
  const asaas = await createAsaasFromEnv(params.env);
  const checkout = await asaas.checkouts.createInstanceCheckout({
    customerId: params.customerId,
    customerData: params.customerData,
    instanceUuid: params.instanceUuid,
    instanceName: params.instanceName,
    successUrl: params.successUrl,
    cancelUrl: params.cancelUrl,
    expiredUrl: params.expiredUrl,
    trialDays: params.trialDays ?? mvpDefaults.billing.trialDays,
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
  const asaas = await createAsaasFromEnv(params.env);
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
