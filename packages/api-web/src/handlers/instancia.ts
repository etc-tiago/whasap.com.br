import { notFound, preconditionFailed } from "@whasap/api-core";
import {
  createEvolutionClient,
  evolutionSecretName,
  parseEvolutionCredentials,
} from "@whasap/evolution";
import { createMetaClient, metaSecretName, parseMetaCredentials } from "@whasap/meta";
import { appCreateData, resolveInternalId } from "@whasap/db";

import { toInstanciaOutput } from "../lib/mappers";
import {
  createAsaasFromEnv,
  createConversationPackCheckout,
  createInstanceCheckout,
  ensureAsaasCustomer,
  mvpDefaults,
} from "../lib/asaas";
import type { WebContext } from "../types";
import {
  requireAdmin,
  requireAdminInternal,
  requireAuth,
  requireOrgInternal,
} from "./auth";

function nivelAlerta(
  count: number,
  limit: number,
): "ok" | "warn80" | "warn90" | "blocked" | null {
  if (limit <= 0) return null;
  const pct = (count / limit) * 100;
  if (pct >= 100) return "blocked";
  if (pct >= 90) return "warn90";
  if (pct >= 80) return "warn80";
  return "ok";
}

export async function getInstanceForOrg(ctx: WebContext, instanciaUuid: string) {
  const row = await ctx.client.instances.findFirst({
    where: { uuid: instanciaUuid },
    include: { organization: true },
  });
  if (!row?.organization) notFound();
  requireOrgInternal(ctx, row.organizationId);
  return row;
}

async function storeEvolutionCredentials(
  ctx: WebContext,
  orgUuid: string,
  instanceUuid: string,
  baseUrl: string,
  apiKey: string,
) {
  const secretName = evolutionSecretName(orgUuid, instanceUuid);
  const payload = JSON.stringify({ baseUrl, apiKey });
  if (ctx.env.EVOLUTION_SECRETS_STORE) {
    await ctx.env.EVOLUTION_SECRETS_STORE.put(secretName, payload);
  }
  return secretName;
}

async function storeMetaCredentials(
  ctx: WebContext,
  orgUuid: string,
  instanceUuid: string,
  creds: { accessToken: string; phoneNumberId: string; wabaId: string },
) {
  const secretName = metaSecretName(orgUuid, instanceUuid);
  const payload = JSON.stringify(creds);
  if (ctx.env.META_SECRETS_STORE) {
    await ctx.env.META_SECRETS_STORE.put(secretName, payload);
  }
  return secretName;
}

export async function getEvolutionCreds(
  ctx: WebContext,
  instance: {
    evolutionSecretName: string | null;
  },
) {
  if (instance.evolutionSecretName && ctx.env.EVOLUTION_SECRETS_STORE) {
    const raw = await ctx.env.EVOLUTION_SECRETS_STORE.get(instance.evolutionSecretName);
    if (raw) return parseEvolutionCredentials(raw);
  }
  const baseUrl = ctx.env.EVOLUTION_BASE_URL;
  const apiKey = ctx.env.EVOLUTION_API_KEY;
  if (baseUrl && apiKey) return { baseUrl, apiKey };
  preconditionFailed("Evolution API não configurada");
}

export async function getMetaCreds(
  ctx: WebContext,
  instance: {
    cloudAccessTokenSecretName: string | null;
  },
) {
  if (!instance.cloudAccessTokenSecretName || !ctx.env.META_SECRETS_STORE) {
    preconditionFailed("Credenciais Meta não configuradas");
  }
  const raw = await ctx.env.META_SECRETS_STORE.get(instance.cloudAccessTokenSecretName);
  if (!raw) preconditionFailed("Credenciais Meta não encontradas");
  return parseMetaCredentials(raw);
}

export const instanciaHandlers = {
  lista: async (ctx: WebContext, input: { organizacaoId: string }) => {
    const internalOrgId = await resolveInternalId(
      ctx.client,
      "organizations",
      input.organizacaoId,
    );
    if (internalOrgId === null) notFound();
    requireOrgInternal(ctx, internalOrgId);

    const org = await ctx.client.organizations.findFirst({
      where: { id: internalOrgId },
    });
    if (!org) notFound();

    const rows = await ctx.client.instances.findMany({
      where: { organizationId: internalOrgId },
    });
    return rows.map((instance) => toInstanciaOutput(instance, org.uuid));
  },

  criar: async (
    ctx: WebContext,
    input: {
      organizacaoId: string;
      nome: string;
      provider: "cloud_api" | "evolution";
    },
  ) => {
    const internalOrgId = await resolveInternalId(
      ctx.client,
      "organizations",
      input.organizacaoId,
    );
    if (internalOrgId === null) notFound();
    requireAdminInternal(ctx, internalOrgId);

    const org = await ctx.client.organizations.findFirst({
      where: { id: internalOrgId },
    });
    if (!org) notFound();

    const instance = await ctx.client.instances.create({
      data: appCreateData({
        organizationId: internalOrgId,
        name: input.nome,
        provider: input.provider,
        status: "pending_connection",
        conversationLimit: mvpDefaults.billing.conversationsPerInstance,
      }),
    });

    return toInstanciaOutput(instance, org.uuid);
  },

  provisionar: async (ctx: WebContext, input: { instanciaId: string }) => {
    requireAuth(ctx);
    const row = await getInstanceForOrg(ctx, input.instanciaId);
    if (row.provider !== "evolution") preconditionFailed("Instância não é Evolution");
    if (row.status !== "pending_connection" && row.status !== "provisioning") {
      preconditionFailed("Instância já provisionada");
    }

    const instanceName = `whasap-${row.uuid.slice(0, 8)}`;
    const webhookUrl = `${ctx.env.WEBHOOK_URL}/evolution`;
    const baseUrl = ctx.env.EVOLUTION_BASE_URL ?? "http://localhost:8080";
    const apiKey = ctx.env.EVOLUTION_API_KEY ?? "dev-key";

    const secretName = await storeEvolutionCredentials(
      ctx,
      row.organization!.uuid,
      row.uuid,
      baseUrl,
      apiKey,
    );

    try {
      const client = createEvolutionClient({ baseUrl, apiKey });
      await client.createInstance(instanceName, webhookUrl);
    } catch (err) {
      console.warn("[evolution] provision skipped or failed:", err);
    }

    await ctx.client.instances.update({
      where: { id: row.id },
      data: {
        status: "provisioning",
        evolutionInstanceName: instanceName,
        evolutionSecretName: secretName,
        provisionAttempts: row.provisionAttempts + 1,
      },
    });

    return { ok: true };
  },

  obterQr: async (ctx: WebContext, input: { instanciaId: string }) => {
    requireAuth(ctx);
    const row = await getInstanceForOrg(ctx, input.instanciaId);
    if (row.provider !== "evolution" || !row.evolutionInstanceName) {
      preconditionFailed("Instância Evolution não provisionada");
    }

    const creds = await getEvolutionCreds(ctx, row);
    const client = createEvolutionClient(creds);

    try {
      const qr = await client.getQrCode(row.evolutionInstanceName);
      const state = await client.getConnectionState(row.evolutionInstanceName);
      return {
        base64: qr.base64 ?? null,
        pairingCode: qr.pairingCode ?? null,
        estado: state.instance.state,
      };
    } catch {
      return { base64: null, pairingCode: null, estado: "connecting" };
    }
  },

  statusConexao: async (ctx: WebContext, input: { instanciaId: string }) => {
    requireAuth(ctx);
    const row = await getInstanceForOrg(ctx, input.instanciaId);

    if (row.provider === "cloud_api") {
      const conectado = Boolean(row.cloudPhoneNumberId && row.cloudWabaId);
      if (conectado && row.status !== "pending_payment" && row.status !== "connected") {
        await ctx.client.instances.update({
          where: { id: row.id },
          data: { status: "pending_payment", connectedAt: new Date() },
        });
      }
      return { estado: conectado ? "open" : "close", conectado };
    }

    if (!row.evolutionInstanceName) {
      return { estado: "close", conectado: false };
    }

    const creds = await getEvolutionCreds(ctx, row);
    const client = createEvolutionClient(creds);

    try {
      const state = await client.getConnectionState(row.evolutionInstanceName);
      const conectado = state.instance.state === "open";
      if (conectado && row.status !== "pending_payment" && row.status !== "connected") {
        await ctx.client.instances.update({
          where: { id: row.id },
          data: { status: "pending_payment", connectedAt: new Date() },
        });
      }
      return { estado: state.instance.state, conectado };
    } catch {
      return { estado: "connecting", conectado: false };
    }
  },

  configurarCloud: async (
    ctx: WebContext,
    input: {
      instanciaId: string;
      phoneNumberId: string;
      wabaId: string;
      accessToken: string;
    },
  ) => {
    requireAuth(ctx);
    const row = await getInstanceForOrg(ctx, input.instanciaId);
    if (row.provider !== "cloud_api") preconditionFailed("Instância não é Cloud API");
    requireAdminInternal(ctx, row.organizationId);

    const secretName = await storeMetaCredentials(ctx, row.organization!.uuid, row.uuid, {
      accessToken: input.accessToken,
      phoneNumberId: input.phoneNumberId,
      wabaId: input.wabaId,
    });

    try {
      const meta = createMetaClient({
        accessToken: input.accessToken,
        phoneNumberId: input.phoneNumberId,
        wabaId: input.wabaId,
      });
      await meta.listTemplates();
    } catch (err) {
      console.warn("[meta] token validation failed:", err);
    }

    await ctx.client.instances.update({
      where: { id: row.id },
      data: {
        cloudPhoneNumberId: input.phoneNumberId,
        cloudWabaId: input.wabaId,
        cloudAccessTokenSecretName: secretName,
        status: "pending_payment",
        connectedAt: new Date(),
      },
    });

    return { ok: true };
  },

  criarCheckout: async (
    ctx: WebContext,
    input: {
      instanciaId: string;
      documento: string;
      tipoDocumento: "cpf" | "cnpj";
      razaoSocial: string;
    },
  ) => {
    requireAuth(ctx);
    const row = await getInstanceForOrg(ctx, input.instanciaId);
    requireAdminInternal(ctx, row.organizationId);

    if (row.status !== "pending_payment") {
      preconditionFailed("Conecte o WhatsApp antes de configurar o pagamento");
    }

    const org = row.organization!;

    await ctx.client.organizations.update({
      where: { id: org.id },
      data: {
        taxId: input.documento,
        taxIdType: input.tipoDocumento,
        legalName: input.razaoSocial,
      },
    });

    const customerId = await ensureAsaasCustomer(ctx.env, {
      ...org,
      taxId: input.documento,
      taxIdType: input.tipoDocumento,
      legalName: input.razaoSocial,
    });

    if (!org.asaasCustomerId) {
      await ctx.client.organizations.update({
        where: { id: org.id },
        data: { asaasCustomerId: customerId },
      });
    }

    const customerData = {
      name: input.razaoSocial,
      cpfCnpj: input.documento,
    };

    const urlCheckout = await createInstanceCheckout({
      env: ctx.env,
      customerId,
      customerData,
      instanceUuid: row.uuid,
      instanceName: row.name,
      successUrl: `${ctx.env.WEB_URL}/onboarding?instance=${row.uuid}&step=concluido`,
      cancelUrl: `${ctx.env.WEB_URL}/onboarding?instance=${row.uuid}&step=pagamento`,
      expiredUrl: `${ctx.env.WEB_URL}/onboarding?instance=${row.uuid}&step=pagamento`,
    });

    return { urlCheckout };
  },

  obter: async (ctx: WebContext, input: { instanciaId: string }) => {
    requireAuth(ctx);
    const row = await getInstanceForOrg(ctx, input.instanciaId);
    return toInstanciaOutput(row, row.organization!.uuid);
  },

  adicionarPacoteConversas: async (ctx: WebContext, input: { instanciaId: string }) => {
    requireAuth(ctx);
    const row = await getInstanceForOrg(ctx, input.instanciaId);
    requireAdminInternal(ctx, row.organizationId);

    const org = row.organization!;
    if (!org.asaasCustomerId) preconditionFailed();

    const customerData = {
      name: org.legalName ?? org.name,
      cpfCnpj: org.taxId ?? "",
    };

    const urlCheckout = await createConversationPackCheckout({
      env: ctx.env,
      customerId: org.asaasCustomerId,
      customerData,
      instanceUuid: row.uuid,
      successUrl: `${ctx.env.WEB_URL}/instancias`,
      cancelUrl: `${ctx.env.WEB_URL}/instancias`,
      expiredUrl: `${ctx.env.WEB_URL}/instancias`,
    });

    return { urlCheckout };
  },
};

export const cobrancaHandlers = {
  assinaturas: async (ctx: WebContext, input: { organizacaoId: string }) => {
    await requireAdmin(ctx, input.organizacaoId);
    const org = await ctx.client.organizations.findFirst({
      where: { uuid: input.organizacaoId },
    });
    if (!org) notFound();

    const instances = await ctx.client.instances.findMany({
      where: { organizationId: org.id },
    });

    const asaas = createAsaasFromEnv(ctx.env);
    const assinaturas = [];

    for (const instance of instances) {
      if (!instance.asaasSubscriptionId) continue;

      let subscriptionStatus = "UNKNOWN";
      let cobrancasPendentes: Array<{
        id: string;
        valor: number;
        vencimento: string;
        urlFatura: string | null;
        status: string;
      }> = [];

      try {
        const subscription = await asaas.subscriptions.get(instance.asaasSubscriptionId);
        subscriptionStatus = subscription.status;

        const payments = await asaas.subscriptions.listPayments(instance.asaasSubscriptionId);
        cobrancasPendentes = payments.data
          .filter((p) => p.status === "PENDING" || p.status === "OVERDUE")
          .map((p) => ({
            id: p.id,
            valor: p.value,
            vencimento: p.dueDate,
            urlFatura: p.invoiceUrl,
            status: p.status,
          }));
      } catch (err) {
        console.warn("[asaas] assinaturas lookup failed:", err);
      }

      assinaturas.push({
        instanciaId: instance.uuid,
        instanciaNome: instance.name,
        asaasSubscriptionId: instance.asaasSubscriptionId,
        statusInstancia: instance.status,
        statusAssinatura: subscriptionStatus,
        cobrancasPendentes,
      });
    }

    return { assinaturas };
  },

  cancelarAssinatura: async (ctx: WebContext, input: { instanciaId: string }) => {
    requireAuth(ctx);
    const row = await getInstanceForOrg(ctx, input.instanciaId);
    requireAdminInternal(ctx, row.organizationId);

    if (!row.asaasSubscriptionId) preconditionFailed("Instância sem assinatura ativa");

    const asaas = createAsaasFromEnv(ctx.env);
    await asaas.subscriptions.cancel(row.asaasSubscriptionId);

    await ctx.client.instances.update({
      where: { id: row.id },
      data: { status: "deactivated", deactivatedAt: new Date() },
    });

    return { ok: true };
  },

  uso: async (ctx: WebContext, input: { instanciaId: string }) => {
    requireAuth(ctx);
    const instance = await ctx.client.instances.findFirst({
      where: { uuid: input.instanciaId },
    });
    if (!instance) notFound();
    requireOrgInternal(ctx, instance.organizationId);

    const anoMes = new Date().toISOString().slice(0, 7);
    const usage = await ctx.client.monthlyUsage.findFirst({
      where: { instanceId: instance.id, yearMonth: anoMes },
    });

    const count = usage?.uniqueContactsCount ?? 0;
    return {
      anoMes,
      contatosUnicos: count,
      limiteConversas: instance.conversationLimit,
      nivelAlerta: nivelAlerta(count, instance.conversationLimit),
    };
  },
};
