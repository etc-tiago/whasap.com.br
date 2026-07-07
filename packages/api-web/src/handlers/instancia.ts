import { notFound, preconditionFailed } from "@whasap/api-core";
import { createEvolutionClient } from "@whasap/evolution";
import { createMetaClient } from "@whasap/meta";
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
  const row = await ctx.client.instancia.findFirst({
    where: { uuid: instanciaUuid },
    include: { organizacao: true },
  });
  if (!row?.organizacao) notFound();
  await requireOrgInternal(ctx, row.organizacaoId);
  return row;
}

export function getEvolutionCreds(env: { EVOLUTION_BASE_URL?: string; EVOLUTION_API_KEY?: string }) {
  const baseUrl = env.EVOLUTION_BASE_URL;
  const apiKey = env.EVOLUTION_API_KEY;
  if (!baseUrl || !apiKey) {
    preconditionFailed("Evolution API não configurada no worker");
  }
  return { baseUrl, apiKey };
}

export function getMetaCreds(instance: {
  nuvemTokenAcesso: string | null;
  nuvemIdNumeroTelefone: string | null;
  nuvemIdWaba: string | null;
}) {
  if (!instance.nuvemTokenAcesso || !instance.nuvemIdNumeroTelefone || !instance.nuvemIdWaba) {
    preconditionFailed("Credenciais Meta não configuradas");
  }
  return {
    accessToken: instance.nuvemTokenAcesso,
    phoneNumberId: instance.nuvemIdNumeroTelefone,
    wabaId: instance.nuvemIdWaba,
  };
}

export const instanciaHandlers = {
  lista: async (ctx: WebContext, input: { organizacaoHash: string }) => {
    const internalOrgId = await resolveInternalId(
      ctx.client,
      "organizacao",
      input.organizacaoHash,
    );
    if (internalOrgId === null) notFound();
    await requireOrgInternal(ctx, internalOrgId);

    const org = await ctx.client.organizacao.findFirst({
      where: { id: internalOrgId },
    });
    if (!org) notFound();

    const rows = await ctx.client.instancia.findMany({
      where: { organizacaoId: internalOrgId },
    });
    return rows.map((instance) => toInstanciaOutput(instance, org.uuid));
  },

  criar: async (
    ctx: WebContext,
    input: {
      organizacaoHash: string;
      nome: string;
      provider: "cloud_api" | "evolution";
    },
  ) => {
    const internalOrgId = await resolveInternalId(
      ctx.client,
      "organizacao",
      input.organizacaoHash,
    );
    if (internalOrgId === null) notFound();
    await requireAdminInternal(ctx, internalOrgId);

    const org = await ctx.client.organizacao.findFirst({
      where: { id: internalOrgId },
    });
    if (!org) notFound();

    const instance = await ctx.client.instancia.create({
      data: appCreateData({
        organizacaoId: internalOrgId,
        nome: input.nome,
        provedor: input.provider,
        status: "pending_connection",
        limiteConversas: mvpDefaults.billing.conversationsPerInstance,
      }),
    });

    return toInstanciaOutput(instance, org.uuid);
  },

  provisionar: async (ctx: WebContext, input: { instanciaId: string }) => {
    requireAuth(ctx);
    const row = await getInstanceForOrg(ctx, input.instanciaId);
    if (row.provedor !== "evolution") preconditionFailed("Instância não é Evolution");
    if (row.status !== "pending_connection" && row.status !== "provisioning") {
      preconditionFailed("Instância já provisionada");
    }

    const { baseUrl, apiKey } = getEvolutionCreds(ctx.env);
    const instanceName = row.evolucaoNomeInstancia ?? `whasap-${row.uuid.slice(0, 8)}`;
    const webhookUrl = `${ctx.env.WEBHOOK_URL}${mvpDefaults.evolution.webhookPath}`;

    try {
      const client = createEvolutionClient({ baseUrl, apiKey });
      if (!row.evolucaoNomeInstancia) {
        await client.createInstance(instanceName, webhookUrl);
      }
    } catch (err) {
      console.warn("[evolution] provision skipped or failed:", err);
    }

    await ctx.client.instancia.update({
      where: { id: row.id },
      data: {
        status: "provisioning",
        evolucaoNomeInstancia: instanceName,
        tentativasProvisionamento: row.tentativasProvisionamento + 1,
      },
    });

    return { ok: true };
  },

  obterQr: async (ctx: WebContext, input: { instanciaId: string }) => {
    requireAuth(ctx);
    const row = await getInstanceForOrg(ctx, input.instanciaId);
    if (row.provedor !== "evolution" || !row.evolucaoNomeInstancia) {
      preconditionFailed("Instância Evolution não provisionada");
    }

    const creds = getEvolutionCreds(ctx.env);
    const client = createEvolutionClient(creds);

    try {
      const qr = await client.getQrCode(row.evolucaoNomeInstancia);
      const state = await client.getConnectionState(row.evolucaoNomeInstancia);
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

    if (row.provedor === "cloud_api") {
      const conectado = Boolean(row.nuvemIdNumeroTelefone && row.nuvemIdWaba && row.nuvemTokenAcesso);
      if (conectado && row.status !== "pending_payment" && row.status !== "connected") {
        await ctx.client.instancia.update({
          where: { id: row.id },
          data: { status: "pending_payment", conectadoEm: new Date() },
        });
      }
      return { estado: conectado ? "open" : "close", conectado };
    }

    if (!row.evolucaoNomeInstancia) {
      return { estado: "close", conectado: false };
    }

    const creds = getEvolutionCreds(ctx.env);
    const client = createEvolutionClient(creds);

    try {
      const state = await client.getConnectionState(row.evolucaoNomeInstancia);
      const conectado = state.instance.state === "open";
      if (conectado && row.status !== "pending_payment" && row.status !== "connected") {
        await ctx.client.instancia.update({
          where: { id: row.id },
          data: { status: "pending_payment", conectadoEm: new Date() },
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
    if (row.provedor !== "cloud_api") preconditionFailed("Instância não é Cloud API");
    await requireAdminInternal(ctx, row.organizacaoId);

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

    await ctx.client.instancia.update({
      where: { id: row.id },
      data: {
        nuvemIdNumeroTelefone: input.phoneNumberId,
        nuvemIdWaba: input.wabaId,
        nuvemTokenAcesso: input.accessToken,
        status: "pending_payment",
        conectadoEm: new Date(),
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
    await requireAdminInternal(ctx, row.organizacaoId);

    if (row.status !== "pending_payment") {
      preconditionFailed("Conecte o WhatsApp antes de configurar o pagamento");
    }

    const org = row.organizacao!;

    await ctx.client.organizacao.update({
      where: { id: org.id },
      data: {
        documentoFiscal: input.documento,
        tipoDocumento: input.tipoDocumento,
        razaoSocial: input.razaoSocial,
      },
    });

    const customerId = await ensureAsaasCustomer(ctx.env, {
      ...org,
      documentoFiscal: input.documento,
      tipoDocumento: input.tipoDocumento,
      razaoSocial: input.razaoSocial,
    });

    if (!org.asaasIdCliente) {
      await ctx.client.organizacao.update({
        where: { id: org.id },
        data: { asaasIdCliente: customerId },
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
      instanceName: row.nome,
      successUrl: `${ctx.env.WEB_URL}/${org.uuid}/integracao?instance=${row.uuid}&step=concluido`,
      cancelUrl: `${ctx.env.WEB_URL}/${org.uuid}/integracao?instance=${row.uuid}&step=pagamento`,
      expiredUrl: `${ctx.env.WEB_URL}/${org.uuid}/integracao?instance=${row.uuid}&step=pagamento`,
    });

    return { urlCheckout };
  },

  obter: async (ctx: WebContext, input: { instanciaId: string }) => {
    requireAuth(ctx);
    const row = await getInstanceForOrg(ctx, input.instanciaId);
    return toInstanciaOutput(row, row.organizacao!.uuid);
  },

  adicionarPacoteConversas: async (ctx: WebContext, input: { instanciaId: string }) => {
    requireAuth(ctx);
    const row = await getInstanceForOrg(ctx, input.instanciaId);
    await requireAdminInternal(ctx, row.organizacaoId);

    const org = row.organizacao!;
    if (!org.asaasIdCliente) preconditionFailed();

    const customerData = {
      name: org.razaoSocial ?? org.nome,
      cpfCnpj: org.documentoFiscal ?? "",
    };

    const urlCheckout = await createConversationPackCheckout({
      env: ctx.env,
      customerId: org.asaasIdCliente,
      customerData,
      instanceUuid: row.uuid,
      successUrl: `${ctx.env.WEB_URL}/${org.uuid}/instancias`,
      cancelUrl: `${ctx.env.WEB_URL}/${org.uuid}/instancias`,
      expiredUrl: `${ctx.env.WEB_URL}/${org.uuid}/instancias`,
    });

    return { urlCheckout };
  },
};

export const cobrancaHandlers = {
  assinaturas: async (ctx: WebContext, input: { organizacaoHash: string }) => {
    await requireAdmin(ctx, input.organizacaoHash);
    const org = await ctx.client.organizacao.findFirst({
      where: { uuid: input.organizacaoHash },
    });
    if (!org) notFound();

    const instances = await ctx.client.instancia.findMany({
      where: { organizacaoId: org.id },
    });

    const asaas = await createAsaasFromEnv(ctx.env);
    const assinaturas = [];

    for (const instance of instances) {
      if (!instance.asaasIdAssinatura) continue;

      let subscriptionStatus = "UNKNOWN";
      let cobrancasPendentes: Array<{
        id: string;
        valor: number;
        vencimento: string;
        urlFatura: string | null;
        status: string;
      }> = [];

      try {
        const subscription = await asaas.subscriptions.get(instance.asaasIdAssinatura);
        subscriptionStatus = subscription.status;

        const payments = await asaas.subscriptions.listPayments(instance.asaasIdAssinatura);
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
        instanciaNome: instance.nome,
        asaasSubscriptionId: instance.asaasIdAssinatura,
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
    await requireAdminInternal(ctx, row.organizacaoId);

    if (!row.asaasIdAssinatura) preconditionFailed("Instância sem assinatura ativa");

    const asaas = await createAsaasFromEnv(ctx.env);
    await asaas.subscriptions.cancel(row.asaasIdAssinatura);

    await ctx.client.instancia.update({
      where: { id: row.id },
      data: { status: "deactivated", desativadoEm: new Date() },
    });

    return { ok: true };
  },

  uso: async (ctx: WebContext, input: { instanciaId: string }) => {
    requireAuth(ctx);
    const instance = await ctx.client.instancia.findFirst({
      where: { uuid: input.instanciaId },
    });
    if (!instance) notFound();
    await requireOrgInternal(ctx, instance.organizacaoId);

    const anoMes = new Date().toISOString().slice(0, 7);
    const usage = await ctx.client.usoMensal.findFirst({
      where: { instanciaId: instance.id, anoMes },
    });

    const count = usage?.contatosUnicosContagem ?? 0;
    return {
      anoMes,
      contatosUnicos: count,
      limiteConversas: instance.limiteConversas,
      nivelAlerta: nivelAlerta(count, instance.limiteConversas),
    };
  },
};
