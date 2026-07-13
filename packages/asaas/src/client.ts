import { mvpDefaults } from "@whasap/config";

export type AsaasConfig = {
  apiKey: string;
  sandbox?: boolean;
};

export type AsaasCustomer = {
  id: string;
  name: string;
  cpfCnpj: string;
};

export type AsaasCheckout = {
  id: string;
  link: string;
  status: string;
};

export type AsaasSubscription = {
  id: string;
  customer: string;
  status: string;
  nextDueDate: string;
  externalReference: string | null;
  value: number;
};

export type AsaasPayment = {
  id: string;
  status: string;
  value: number;
  dueDate: string;
  invoiceUrl: string | null;
  subscription: string | null;
};

function asaasBaseUrl(sandbox?: boolean): string {
  return sandbox ? "https://api-sandbox.asaas.com/v3" : "https://api.asaas.com/v3";
}

function formatDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function centsToValue(cents: number): number {
  return cents / 100;
}

export function createAsaasClient(config: AsaasConfig) {
  const baseUrl = asaasBaseUrl(config.sandbox);

  async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
    const res = await fetch(`${baseUrl}${path}`, {
      method,
      headers: {
        accept: "application/json",
        "content-type": "application/json",
        access_token: config.apiKey,
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Asaas API error (${res.status}): ${err}`);
    }
    if (res.status === 204) return undefined as T;
    return res.json() as Promise<T>;
  }

  return {
    customers: {
      create(params: { name: string; cpfCnpj: string; email?: string }) {
        return request<AsaasCustomer>("POST", "/customers", {
          name: params.name,
          cpfCnpj: params.cpfCnpj.replace(/\D/g, ""),
          ...(params.email ? { email: params.email } : {}),
        });
      },
    },

    checkouts: {
      createOrgBaseCheckout(params: {
        customerId: string;
        customerData: { name: string; cpfCnpj: string; email?: string };
        organizacaoUuid: string;
        organizacaoNome: string;
        successUrl: string;
        cancelUrl: string;
        expiredUrl: string;
        trialDays?: number;
      }) {
        const trialDays = params.trialDays ?? mvpDefaults.billing.trialDays;
        const nextDueDate = formatDate(addDays(new Date(), trialDays));
        const value = centsToValue(mvpDefaults.billing.orgBasePriceCents);
        const externalReference = `org:${params.organizacaoUuid}`;

        return request<AsaasCheckout>("POST", "/checkouts", {
          billingTypes: ["PIX", "CREDIT_CARD"],
          chargeTypes: ["RECURRENT"],
          minutesToExpire: 60,
          externalReference,
          customer: params.customerId,
          callback: {
            successUrl: params.successUrl,
            cancelUrl: params.cancelUrl,
            expiredUrl: params.expiredUrl,
          },
          customerData: {
            name: params.customerData.name,
            cpfCnpj: params.customerData.cpfCnpj.replace(/\D/g, ""),
            ...(params.customerData.email ? { email: params.customerData.email } : {}),
          },
          items: [
            {
              name: `Plano Whasap — ${params.organizacaoNome}`,
              description: `${mvpDefaults.billing.conversationsIncludedBase} conversas/mês incluídas`,
              quantity: 1,
              value,
            },
          ],
          subscription: {
            cycle: "MONTHLY",
            nextDueDate,
            externalReference,
          },
        });
      },

      createInstanceCheckout(params: {
        customerId: string;
        customerData: { name: string; cpfCnpj: string; email?: string };
        instanceUuid: string;
        instanceName: string;
        successUrl: string;
        cancelUrl: string;
        expiredUrl: string;
        trialDays?: number;
      }) {
        const trialDays = params.trialDays ?? mvpDefaults.billing.trialDays;
        const nextDueDate = formatDate(addDays(new Date(), trialDays));
        const value = centsToValue(mvpDefaults.billing.connectionPriceCents);
        const externalReference = `instance:${params.instanceUuid}`;

        return request<AsaasCheckout>("POST", "/checkouts", {
          billingTypes: ["PIX", "CREDIT_CARD"],
          chargeTypes: ["RECURRENT"],
          minutesToExpire: 60,
          externalReference,
          customer: params.customerId,
          callback: {
            successUrl: params.successUrl,
            cancelUrl: params.cancelUrl,
            expiredUrl: params.expiredUrl,
          },
          customerData: {
            name: params.customerData.name,
            cpfCnpj: params.customerData.cpfCnpj.replace(/\D/g, ""),
            ...(params.customerData.email ? { email: params.customerData.email } : {}),
          },
          items: [
            {
              name: `Conexão WhatsApp — ${params.instanceName}`,
              description: "Assinatura mensal por conexão",
              quantity: 1,
              value,
            },
          ],
          subscription: {
            cycle: "MONTHLY",
            nextDueDate,
            externalReference,
          },
        });
      },

      createConversationPackCheckout(params: {
        customerId: string;
        customerData: { name: string; cpfCnpj: string; email?: string };
        instanceUuid: string;
        successUrl: string;
        cancelUrl: string;
        expiredUrl: string;
      }) {
        const value = centsToValue(mvpDefaults.billing.conversationPackPriceCents);
        const externalReference = `pack:${params.instanceUuid}`;

        return request<AsaasCheckout>("POST", "/checkouts", {
          billingTypes: ["PIX", "CREDIT_CARD"],
          chargeTypes: ["RECURRENT"],
          minutesToExpire: 60,
          externalReference,
          customer: params.customerId,
          callback: {
            successUrl: params.successUrl,
            cancelUrl: params.cancelUrl,
            expiredUrl: params.expiredUrl,
          },
          customerData: {
            name: params.customerData.name,
            cpfCnpj: params.customerData.cpfCnpj.replace(/\D/g, ""),
            ...(params.customerData.email ? { email: params.customerData.email } : {}),
          },
          items: [
            {
              name: "Pacote +1.000 conversas",
              description: `+${mvpDefaults.billing.conversationsPerPack} conversas/mês`,
              quantity: 1,
              value,
            },
          ],
          subscription: {
            cycle: "MONTHLY",
            nextDueDate: formatDate(new Date()),
            externalReference,
          },
        });
      },
    },

    subscriptions: {
      get(id: string) {
        return request<AsaasSubscription>("GET", `/subscriptions/${id}`);
      },

      listPayments(subscriptionId: string) {
        return request<{ data: AsaasPayment[] }>(
          "GET",
          `/subscriptions/${subscriptionId}/payments`,
        );
      },

      cancel(id: string) {
        return request<AsaasSubscription>("DELETE", `/subscriptions/${id}`);
      },

      listByCustomer(customerId: string) {
        return request<{ data: AsaasSubscription[] }>(
          "GET",
          `/subscriptions?customer=${encodeURIComponent(customerId)}&limit=100`,
        );
      },
    },
  };
}

export type AsaasClient = ReturnType<typeof createAsaasClient>;
