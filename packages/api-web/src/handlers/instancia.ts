import { and, eq, isNull } from "drizzle-orm";
import { notFound, preconditionFailed } from "@whasap/api-core";
import { isEvolutionProvider } from "@whasap/config";
import { createEvolutionGoClient, parseGoConnectionState } from "@whasap/evolution";
import { createMetaClient } from "@whasap/meta";
import {
  instancia,
  organizacao,
  colunasInstanciaOperacao,
  colunasInstanciaPublica,
  colunasInstanciaUso,
  colunasOrganizacaoPublica,
  colunasUsoMensal,
  comTimestampsCriacao,
  comTimestampAtualizacao,
  incluirOrganizacaoPublica,
  resolverIdInterno,
  usoMensal,
} from "@whasap/db";

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
  exigirAdmin,
  exigirAdminPorIdInterno,
  exigirAutenticacao,
  exigirOrganizacaoPorIdInterno,
} from "./auth";

function nivelAlerta(count: number, limit: number): "ok" | "warn80" | "warn90" | "blocked" | null {
  if (limit <= 0) return null;
  const pct = (count / limit) * 100;
  if (pct >= 100) return "blocked";
  if (pct >= 90) return "warn90";
  if (pct >= 80) return "warn80";
  return "ok";
}

/**
 * Busca instância da organização do usuário autenticado.
 * @throws 404 se não existir; 403 se sem acesso à org.
 */
export async function buscarInstanciaDaOrganizacao(ctx: WebContext, instanciaUuid: string) {
  const row = await ctx.db.query.instancia.findFirst({
    where: and(eq(instancia.uuid, instanciaUuid), isNull(instancia.excluidoEm)),
    columns: colunasInstanciaOperacao,
    with: { organizacao: incluirOrganizacaoPublica },
  });
  if (!row?.organizacao) notFound();
  await exigirOrganizacaoPorIdInterno(ctx, row.organizacaoId);
  return row;
}

/** Obtém credenciais Evolution do ambiente do worker. */
export function obterCredenciaisEvolution(env: {
  EVOLUTION_BASE_URL?: string;
  EVOLUTION_API_KEY?: string;
}) {
  const baseUrl = env.EVOLUTION_BASE_URL;
  const apiKey = env.EVOLUTION_API_KEY;
  if (!baseUrl || !apiKey) {
    preconditionFailed("Evolution API não configurada no worker");
  }
  return { baseUrl, apiKey };
}

/** Obtém credenciais Meta Cloud API da instância. */
export function obterCredenciaisMeta(instance: {
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

/** Handlers de instâncias WhatsApp: provisionamento, QR, checkout e uso mensal. */
export const instanciaHandlers = {
  /** Lista instâncias da organização (membro autenticado). */
  lista: async (ctx: WebContext, input: { organizacaoHash: string }) => {
    const internalOrgId = await resolverIdInterno(ctx.db, "organizacao", input.organizacaoHash);
    if (internalOrgId === null) notFound();
    await exigirOrganizacaoPorIdInterno(ctx, internalOrgId);

    const org = await ctx.db.query.organizacao.findFirst({
      where: and(eq(organizacao.id, internalOrgId), isNull(organizacao.excluidoEm)),
      columns: colunasOrganizacaoPublica,
    });
    if (!org) notFound();

    const rows = await ctx.db.query.instancia.findMany({
      where: and(eq(instancia.organizacaoId, internalOrgId), isNull(instancia.excluidoEm)),
      columns: colunasInstanciaPublica,
    });
    return rows.map((instance) => toInstanciaOutput(instance, org.uuid));
  },

  /** Cria instância em `pending_connection` (somente admin). */
  criar: async (
    ctx: WebContext,
    input: {
      organizacaoHash: string;
      nome: string;
      provider: "cloud_api" | "evolution";
    },
  ) => {
    const internalOrgId = await resolverIdInterno(ctx.db, "organizacao", input.organizacaoHash);
    if (internalOrgId === null) notFound();
    await exigirAdminPorIdInterno(ctx, internalOrgId);

    const org = await ctx.db.query.organizacao.findFirst({
      where: and(eq(organizacao.id, internalOrgId), isNull(organizacao.excluidoEm)),
      columns: colunasOrganizacaoPublica,
    });
    if (!org) notFound();

    const [instance] = await ctx.db
      .insert(instancia)
      .values(
        comTimestampsCriacao({
          organizacaoId: internalOrgId,
          nome: input.nome,
          provedor: input.provider,
          status: "pending_connection",
          limiteConversas: mvpDefaults.billing.conversationsPerInstance,
        }),
      )
      .returning();

    return toInstanciaOutput(instance!, org.uuid);
  },

  provisionar: async (ctx: WebContext, input: { instanciaId: string }) => {
    exigirAutenticacao(ctx);
    const row = await buscarInstanciaDaOrganizacao(ctx, input.instanciaId);
    if (!isEvolutionProvider(row.provedor)) preconditionFailed("Instância não é Evolution");
    if (row.status !== "pending_connection" && row.status !== "provisioning") {
      preconditionFailed("Instância já provisionada");
    }

    const { baseUrl, apiKey } = obterCredenciaisEvolution(ctx.env);
    const webhookUrl = `${ctx.env.WEBHOOK_URL}${mvpDefaults.evolution.webhookPath}`;

    const instanceName = row.evolucaoNomeInstancia ?? `whasap-${row.uuid.slice(0, 8)}`;
    const instanceId = row.evolucaoInstanceId ?? row.uuid;
    const instanceToken = row.evolucaoToken ?? crypto.randomUUID().replace(/-/g, "");

    try {
      const admin = createEvolutionGoClient({ baseUrl, apiKey });
      if (!row.evolucaoInstanceId) {
        await admin.createInstance({ name: instanceName, instanceId, token: instanceToken });
      }
      const client = createEvolutionGoClient({ baseUrl, apiKey }, { instanceToken });
      await client.connect(webhookUrl);
    } catch (err) {
      console.warn("[evolution] provision skipped or failed:", err);
    }

    await ctx.db
      .update(instancia)
      .set(
        comTimestampAtualizacao({
          status: "provisioning",
          evolucaoNomeInstancia: instanceName,
          evolucaoInstanceId: instanceId,
          evolucaoToken: instanceToken,
          tentativasProvisionamento: row.tentativasProvisionamento + 1,
        }),
      )
      .where(eq(instancia.id, row.id));

    return { ok: true };
  },

  obterQr: async (ctx: WebContext, input: { instanciaId: string }) => {
    exigirAutenticacao(ctx);
    const row = await buscarInstanciaDaOrganizacao(ctx, input.instanciaId);
    if (!isEvolutionProvider(row.provedor)) {
      preconditionFailed("Instância não é Evolution");
    }

    if (!row.evolucaoToken) preconditionFailed("Instância não provisionada");

    const creds = obterCredenciaisEvolution(ctx.env);
    const client = createEvolutionGoClient(creds, { instanceToken: row.evolucaoToken });
    try {
      const qr = await client.getQrCode();
      const state = await client.getStatus();
      return {
        base64: qr.base64 ?? null,
        pairingCode: qr.pairingCode ?? null,
        estado: parseGoConnectionState(state),
      };
    } catch {
      return { base64: null, pairingCode: null, estado: "connecting" };
    }
  },

  statusConexao: async (ctx: WebContext, input: { instanciaId: string }) => {
    exigirAutenticacao(ctx);
    const row = await buscarInstanciaDaOrganizacao(ctx, input.instanciaId);

    if (row.provedor === "cloud_api") {
      const conectado = Boolean(
        row.nuvemIdNumeroTelefone && row.nuvemIdWaba && row.nuvemTokenAcesso,
      );
      if (conectado && row.status !== "pending_payment" && row.status !== "connected") {
        await ctx.db
          .update(instancia)
          .set(comTimestampAtualizacao({ status: "pending_payment", conectadoEm: new Date() }))
          .where(eq(instancia.id, row.id));
      }
      return { estado: conectado ? "open" : "close", conectado };
    }

    if (!row.evolucaoToken) {
      return { estado: "close", conectado: false };
    }

    const creds = obterCredenciaisEvolution(ctx.env);
    const client = createEvolutionGoClient(creds, { instanceToken: row.evolucaoToken });
    try {
      const state = await client.getStatus();
      const estado = parseGoConnectionState(state);
      const conectado = estado === "open";
      if (conectado && row.status !== "pending_payment" && row.status !== "connected") {
        await ctx.db
          .update(instancia)
          .set(comTimestampAtualizacao({ status: "pending_payment", conectadoEm: new Date() }))
          .where(eq(instancia.id, row.id));
      }
      return { estado, conectado };
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
    exigirAutenticacao(ctx);
    const row = await buscarInstanciaDaOrganizacao(ctx, input.instanciaId);
    if (row.provedor !== "cloud_api") preconditionFailed("Instância não é Cloud API");
    await exigirAdminPorIdInterno(ctx, row.organizacaoId);

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

    await ctx.db
      .update(instancia)
      .set(
        comTimestampAtualizacao({
          nuvemIdNumeroTelefone: input.phoneNumberId,
          nuvemIdWaba: input.wabaId,
          nuvemTokenAcesso: input.accessToken,
          status: "pending_payment",
          conectadoEm: new Date(),
        }),
      )
      .where(eq(instancia.id, row.id));

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
    exigirAutenticacao(ctx);
    const row = await buscarInstanciaDaOrganizacao(ctx, input.instanciaId);
    await exigirAdminPorIdInterno(ctx, row.organizacaoId);

    if (row.status !== "pending_payment") {
      preconditionFailed("Conecte o WhatsApp antes de configurar o pagamento");
    }

    const org = row.organizacao!;

    await ctx.db
      .update(organizacao)
      .set(
        comTimestampAtualizacao({
          documentoFiscal: input.documento,
          tipoDocumento: input.tipoDocumento,
          razaoSocial: input.razaoSocial,
        }),
      )
      .where(eq(organizacao.id, org.id));

    const customerId = await ensureAsaasCustomer(ctx.env, {
      asaasIdCliente: org.asaasIdCliente,
      nome: org.nome,
      documentoFiscal: input.documento,
      razaoSocial: input.razaoSocial,
    });

    if (!org.asaasIdCliente) {
      await ctx.db
        .update(organizacao)
        .set(comTimestampAtualizacao({ asaasIdCliente: customerId }))
        .where(eq(organizacao.id, org.id));
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
    exigirAutenticacao(ctx);
    const row = await buscarInstanciaDaOrganizacao(ctx, input.instanciaId);
    return toInstanciaOutput(row, row.organizacao!.uuid);
  },

  adicionarPacoteConversas: async (ctx: WebContext, input: { instanciaId: string }) => {
    exigirAutenticacao(ctx);
    const row = await buscarInstanciaDaOrganizacao(ctx, input.instanciaId);
    await exigirAdminPorIdInterno(ctx, row.organizacaoId);

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

/** Handlers de cobrança Asaas: assinaturas, cancelamento e uso mensal. */
export const cobrancaHandlers = {
  /** Lista assinaturas e cobranças pendentes de todas as instâncias da org (admin). */
  assinaturas: async (ctx: WebContext, input: { organizacaoHash: string }) => {
    await exigirAdmin(ctx, input.organizacaoHash);
    const org = await ctx.db.query.organizacao.findFirst({
      where: and(eq(organizacao.uuid, input.organizacaoHash), isNull(organizacao.excluidoEm)),
      columns: colunasOrganizacaoPublica,
    });
    if (!org) notFound();

    const instances = await ctx.db.query.instancia.findMany({
      where: and(eq(instancia.organizacaoId, org.id), isNull(instancia.excluidoEm)),
      columns: colunasInstanciaPublica,
    });

    const asaas = await createAsaasFromEnv(ctx.env);

    const assinaturas = await Promise.all(
      instances
        .filter((instance) => instance.asaasIdAssinatura)
        .map(async (instance) => {
          const asaasIdAssinatura = instance.asaasIdAssinatura!;

          let subscriptionStatus = "UNKNOWN";
          let cobrancasPendentes: Array<{
            id: string;
            valor: number;
            vencimento: string;
            urlFatura: string | null;
            status: string;
          }> = [];

          try {
            const subscription = await asaas.subscriptions.get(asaasIdAssinatura);
            subscriptionStatus = subscription.status;

            const payments = await asaas.subscriptions.listPayments(asaasIdAssinatura);
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

          return {
            instanciaId: instance.uuid,
            instanciaNome: instance.nome,
            asaasSubscriptionId: asaasIdAssinatura,
            statusInstancia: instance.status,
            statusAssinatura: subscriptionStatus,
            cobrancasPendentes,
          };
        }),
    );

    return { assinaturas };
  },

  cancelarAssinatura: async (ctx: WebContext, input: { instanciaId: string }) => {
    exigirAutenticacao(ctx);
    const row = await buscarInstanciaDaOrganizacao(ctx, input.instanciaId);
    await exigirAdminPorIdInterno(ctx, row.organizacaoId);

    if (!row.asaasIdAssinatura) preconditionFailed("Instância sem assinatura ativa");

    const asaas = await createAsaasFromEnv(ctx.env);
    await asaas.subscriptions.cancel(row.asaasIdAssinatura);

    await ctx.db
      .update(instancia)
      .set(comTimestampAtualizacao({ status: "deactivated", desativadoEm: new Date() }))
      .where(eq(instancia.id, row.id));

    return { ok: true };
  },

  uso: async (ctx: WebContext, input: { instanciaId: string }) => {
    exigirAutenticacao(ctx);
    const instance = await ctx.db.query.instancia.findFirst({
      where: and(eq(instancia.uuid, input.instanciaId), isNull(instancia.excluidoEm)),
      columns: colunasInstanciaUso,
    });
    if (!instance) notFound();
    await exigirOrganizacaoPorIdInterno(ctx, instance.organizacaoId);

    const anoMes = new Date().toISOString().slice(0, 7);
    const usage = await ctx.db.query.usoMensal.findFirst({
      where: and(eq(usoMensal.instanciaId, instance.id), eq(usoMensal.anoMes, anoMes)),
      columns: colunasUsoMensal,
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

/** @deprecated Use `buscarInstanciaDaOrganizacao` */
export const getInstanceForOrg = buscarInstanciaDaOrganizacao;
/** @deprecated Use `obterCredenciaisEvolution` */
export const getEvolutionCreds = obterCredenciaisEvolution;
/** @deprecated Use `obterCredenciaisMeta` */
export const getMetaCreds = obterCredenciaisMeta;
