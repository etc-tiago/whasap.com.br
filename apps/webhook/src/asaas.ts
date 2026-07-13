import { and, eq, isNull } from "drizzle-orm";
import { createAsaasClient, parseAsaasExternalReference } from "@whasap/asaas";
import { getAsaasApiKey, isAsaasSandbox } from "@whasap/api-core";
import { mvpDefaults } from "@whasap/config";
import {
  colunasInstanciaAddon,
  colunasInstanciaAsaasStatus,
  colunasSomenteId,
  comCriadoEm,
  comTimestampAtualizacao,
  instancia,
  instanciaAddon,
  organizacao,
  type Db,
} from "@whasap/db";

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

/** Ativa taxa base da organização após pagamento Asaas. */
async function ativarAssinaturaBaseOrg(
  db: Db,
  organizacaoUuid: string,
  subscriptionId: string,
): Promise<void> {
  const org = await db.query.organizacao.findFirst({
    where: and(eq(organizacao.uuid, organizacaoUuid), isNull(organizacao.excluidoEm)),
    columns: { id: true, asaasIdAssinaturaBase: true, limiteConversas: true },
  });
  if (!org) return;
  if (org.asaasIdAssinaturaBase === subscriptionId) return;

  await db
    .update(organizacao)
    .set(
      comTimestampAtualizacao({
        asaasIdAssinaturaBase: subscriptionId,
        // Garante cota base se a org ainda estiver no default ou zerada.
        limiteConversas: Math.max(
          org.limiteConversas,
          mvpDefaults.billing.conversationsIncludedBase,
        ),
      }),
    )
    .where(eq(organizacao.id, org.id));
}

/** Ativa instância após pagamento/checkout Asaas (`status: connected`). */
async function ativarInstanciaAposPagamento(
  db: Db,
  instanceUuid: string,
  subscriptionId: string,
  trialEndsAt: Date | null,
): Promise<void> {
  const row = await db.query.instancia.findFirst({
    where: and(eq(instancia.uuid, instanceUuid), isNull(instancia.excluidoEm)),
    columns: colunasSomenteId,
  });
  if (!row) return;

  await db
    .update(instancia)
    .set(
      comTimestampAtualizacao({
        status: "connected",
        asaasIdAssinatura: subscriptionId,
        trialTerminaEm: trialEndsAt,
      }),
    )
    .where(eq(instancia.id, row.id));
}

/** Adiciona pacote de conversas à cota da org após assinatura de addon. */
async function ativarPacoteConversas(
  db: Db,
  instanceUuid: string,
  subscriptionId: string,
): Promise<void> {
  const instance = await db.query.instancia.findFirst({
    where: and(eq(instancia.uuid, instanceUuid), isNull(instancia.excluidoEm)),
    columns: { id: true, organizacaoId: true },
  });
  if (!instance) return;

  const existing = await db.query.instanciaAddon.findFirst({
    where: and(
      eq(instanciaAddon.instanciaId, instance.id),
      eq(instanciaAddon.asaasIdAssinatura, subscriptionId),
    ),
    columns: colunasInstanciaAddon,
  });
  if (existing) return;

  await db.insert(instanciaAddon).values(
    comCriadoEm({
      instanciaId: instance.id,
      asaasIdAssinatura: subscriptionId,
      tamanhoPacoteConversas: mvpDefaults.billing.conversationsPerPack,
    }),
  );

  const org = await db.query.organizacao.findFirst({
    where: and(eq(organizacao.id, instance.organizacaoId), isNull(organizacao.excluidoEm)),
    columns: { id: true, limiteConversas: true },
  });
  if (!org) return;

  await db
    .update(organizacao)
    .set(
      comTimestampAtualizacao({
        limiteConversas: org.limiteConversas + mvpDefaults.billing.conversationsPerPack,
      }),
    )
    .where(eq(organizacao.id, org.id));
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

async function ativarPorReferencia(
  db: Db,
  ref: NonNullable<ReturnType<typeof parseAsaasExternalReference>>,
  subscriptionId: string,
  trialEndsAt: Date | null,
): Promise<void> {
  if (ref.type === "org") {
    await ativarAssinaturaBaseOrg(db, ref.organizacaoUuid, subscriptionId);
    return;
  }
  if (ref.type === "instance") {
    await ativarInstanciaAposPagamento(db, ref.instanceUuid, subscriptionId, trialEndsAt);
    return;
  }
  if (ref.type === "pack") {
    await ativarPacoteConversas(db, ref.instanceUuid, subscriptionId);
  }
}

/** Processa eventos de webhook do Asaas (assinaturas e pagamentos). */
export async function handleAsaasWebhook(db: Db, payload: string, env: Env): Promise<void> {
  const event = JSON.parse(payload) as AsaasWebhookEvent;

  if (event.event === "SUBSCRIPTION_CREATED" && event.subscription) {
    const sub = event.subscription;
    const ref = parseAsaasExternalReference(sub.externalReference);
    if (!ref) return;
    await ativarPorReferencia(db, ref, sub.id, parseTrialEndsAt(sub.nextDueDate));
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

    await ativarPorReferencia(
      db,
      ref,
      subscriptionId,
      parseTrialEndsAt(checkout.subscription?.nextDueDate),
    );
    return;
  }

  if (event.event === "SUBSCRIPTION_DELETED" && event.subscription) {
    const subId = event.subscription.id;

    const orgBase = await db.query.organizacao.findFirst({
      where: and(eq(organizacao.asaasIdAssinaturaBase, subId), isNull(organizacao.excluidoEm)),
      columns: colunasSomenteId,
    });
    if (orgBase) {
      await db
        .update(organizacao)
        .set(comTimestampAtualizacao({ asaasIdAssinaturaBase: null }))
        .where(eq(organizacao.id, orgBase.id));
      return;
    }

    const row = await db.query.instancia.findFirst({
      where: and(eq(instancia.asaasIdAssinatura, subId), isNull(instancia.excluidoEm)),
      columns: colunasSomenteId,
    });
    if (!row) return;

    await db
      .update(instancia)
      .set(comTimestampAtualizacao({ status: "deactivated", desativadoEm: new Date() }))
      .where(eq(instancia.id, row.id));
    return;
  }

  if (event.event === "PAYMENT_OVERDUE" && event.payment?.subscription) {
    const subId = event.payment.subscription;
    const row = await db.query.instancia.findFirst({
      where: and(eq(instancia.asaasIdAssinatura, subId), isNull(instancia.excluidoEm)),
      columns: colunasInstanciaAsaasStatus,
    });
    if (!row) return;

    const pastTrial = !row.trialTerminaEm || row.trialTerminaEm.getTime() < Date.now();
    if (pastTrial) {
      await db
        .update(instancia)
        .set(comTimestampAtualizacao({ status: "deactivated", desativadoEm: new Date() }))
        .where(eq(instancia.id, row.id));
    }
  }
}
