import { createAsaasClient, parseAsaasExternalReference } from "@whasap/asaas";
import { getAsaasApiKey, isAsaasSandbox } from "@whasap/api-core";
import { mvpDefaults } from "@whasap/config";
import { appCreateData, type Client } from "@whasap/db";

import type { Env } from "./env";

type AsaasWebhookEvent = {
  id: string;
  event: string;
  checkout?: {
    id: string;
    externalReference?: string | null;
    customer?: string | null;
    subscription?: {
      cycle?: string;
      nextDueDate?: string;
    } | null;
  };
  subscription?: {
    id: string;
    customer?: string;
    status?: string;
    nextDueDate?: string;
    externalReference?: string | null;
  };
  payment?: {
    id: string;
    subscription?: string | null;
    status?: string;
  };
};

function parseTrialEndsAt(nextDueDate: string | undefined | null): Date | null {
  if (!nextDueDate) {
    return new Date(Date.now() + mvpDefaults.billing.trialDays * 24 * 60 * 60 * 1000);
  }
  const parsed = new Date(nextDueDate);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

async function activateInstance(
  client: Client,
  instanceUuid: string,
  subscriptionId: string,
  trialEndsAt: Date | null,
): Promise<void> {
  const instance = await client.instancia.findFirst({
    where: { uuid: instanceUuid },
    select: { id: true },
  });
  if (!instance) return;

  await client.instancia.update({
    where: { id: instance.id },
    data: {
      status: "connected",
      asaasIdAssinatura: subscriptionId,
      trialTerminaEm: trialEndsAt,
    },
  });
}

async function activateConversationPack(
  client: Client,
  instanceUuid: string,
  subscriptionId: string,
): Promise<void> {
  const instance = await client.instancia.findFirst({
    where: { uuid: instanceUuid },
  });
  if (!instance) return;

  const existing = await client.instanciaAddon.findFirst({
    where: { instanciaId: instance.id, asaasIdAssinatura: subscriptionId },
  });
  if (existing) return;

  await client.instanciaAddon.create({
    data: appCreateData({
      instanciaId: instance.id,
      asaasIdAssinatura: subscriptionId,
      tamanhoPacoteConversas: mvpDefaults.billing.conversationsPerPack,
    }),
  });

  await client.instancia.update({
    where: { id: instance.id },
    data: {
      limiteConversas:
        instance.limiteConversas + mvpDefaults.billing.conversationsPerPack,
    },
  });
}

async function resolveSubscriptionId(
  env: Env,
  customerId: string | null | undefined,
  externalReference: string,
): Promise<string | null> {
  if (!customerId) return null;
  const asaas = createAsaasClient({
    apiKey: await getAsaasApiKey(env),
    sandbox: isAsaasSandbox(env),
  });
  const parsed = parseAsaasExternalReference(externalReference);
  if (!parsed) return null;

  const { data } = await asaas.subscriptions.listByCustomer(customerId);
  const match = data.find((sub) => sub.externalReference === externalReference);
  return match?.id ?? data.at(-1)?.id ?? null;
}

export async function handleAsaasWebhook(
  client: Client,
  payload: string,
  env: Env,
): Promise<void> {
  const event = JSON.parse(payload) as AsaasWebhookEvent;

  if (event.event === "SUBSCRIPTION_CREATED" && event.subscription) {
    const sub = event.subscription;
    const ref = parseAsaasExternalReference(sub.externalReference);
    if (!ref) return;

    if (ref.type === "instance") {
      await activateInstance(
        client,
        ref.instanceUuid,
        sub.id,
        parseTrialEndsAt(sub.nextDueDate),
      );
      return;
    }

    if (ref.type === "pack") {
      await activateConversationPack(client, ref.instanceUuid, sub.id);
    }
    return;
  }

  if (event.event === "CHECKOUT_PAID" && event.checkout) {
    const checkout = event.checkout;
    const ref = parseAsaasExternalReference(checkout.externalReference);
    if (!ref) return;

    const subscriptionId =
      (await resolveSubscriptionId(env, checkout.customer, checkout.externalReference ?? "")) ??
      null;

    if (!subscriptionId) return;

    if (ref.type === "instance") {
      await activateInstance(
        client,
        ref.instanceUuid,
        subscriptionId,
        parseTrialEndsAt(checkout.subscription?.nextDueDate),
      );
      return;
    }

    if (ref.type === "pack") {
      await activateConversationPack(client, ref.instanceUuid, subscriptionId);
    }
    return;
  }

  if (event.event === "SUBSCRIPTION_DELETED" && event.subscription) {
    const subId = event.subscription.id;
    const instance = await client.instancia.findFirst({
      where: { asaasIdAssinatura: subId },
      select: { id: true },
    });
    if (!instance) return;

    await client.instancia.update({
      where: { id: instance.id },
      data: { status: "deactivated", desativadoEm: new Date() },
    });
    return;
  }

  if (event.event === "PAYMENT_OVERDUE" && event.payment?.subscription) {
    const subId = event.payment.subscription;
    const instance = await client.instancia.findFirst({
      where: { asaasIdAssinatura: subId },
      select: { id: true, trialTerminaEm: true },
    });
    if (!instance) return;

    const pastTrial =
      !instance.trialTerminaEm || instance.trialTerminaEm.getTime() < Date.now();
    if (pastTrial) {
      await client.instancia.update({
        where: { id: instance.id },
        data: { status: "deactivated", desativadoEm: new Date() },
      });
    }
  }
}
