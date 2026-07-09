import { criarClienteEvolutionGo, getEvolutionCredentials, notFound, preconditionFailed } from "@whasap/api-core";
import { isEvolutionProvider } from "@whasap/config";
import {
  colunasInstanciaOperacao,
  colunasInstanciaPublica,
  colunasInstanciaUso,
  colunasOrganizacaoPublica,
  colunasUsoMensal,
  comTimestampAtualizacao,
  comTimestampsCriacao,
  incluirOrganizacaoPublica,
  instancia,
  marcarExclusaoLogica,
  organizacao,
  resolverIdInterno,
  usoMensal,
} from "@whasap/db";
import { log } from "@whasap/evlog";
import {
  EVOLUTION_WEBHOOK_SUBSCRIBE_ALL,
  parseGoConnectionState,
  parseGoQrResponse,
  type EvolutionGoStatusResponse,
} from "@whasap/evolution";
import { createMetaClient } from "@whasap/meta";
import { and, eq, isNull } from "drizzle-orm";

import {
  createAsaasFromEnv,
  createConversationPackCheckout,
  createInstanceCheckout,
  ensureAsaasCustomer,
  mvpDefaults,
} from "../lib/asaas";
import {
  diasTrialAsaasRestantes,
  exigirAcessoDemonstracao,
  marcarInstanciaConectada,
} from "../lib/demonstracao";
import { configurarWebhookInstanciaEvolution, urlWebhookEvolution } from "../lib/evolution-webhook";
import {
  mensagemErroEvolution,
  montarDebugEvolution,
  statusHttpErroEvolution,
} from "../lib/evolution-debug";
import { toInstanciaOutput } from "../lib/mappers";
import type { WebContext, WebEnv } from "../types";
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

/** Obtém credenciais Evolution do Secrets Store (ou JSON em `.dev.vars`). */
export async function obterCredenciaisEvolution(env: WebEnv) {
  try {
    return await getEvolutionCredentials(env);
  } catch {
    preconditionFailed("Evolution API não configurada no worker");
  }
}

function metaLogEvolution(row: { uuid: string; evolucaoInstanceId?: string | null }) {
  return {
    instanciaUuid: row.uuid,
    ...(row.evolucaoInstanceId ? { evolutionInstanceId: row.evolucaoInstanceId } : {}),
  };
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
    await exigirAcessoDemonstracao(ctx, internalOrgId);

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
    await exigirAcessoDemonstracao(ctx, row.organizacaoId);
    if (!isEvolutionProvider(row.provedor)) preconditionFailed("Instância não é Evolution");
    if (
      row.status !== "pending_connection" &&
      row.status !== "provisioning" &&
      row.status !== "disconnected"
    ) {
      preconditionFailed("Instância já provisionada");
    }

    const { baseUrl, apiKey } = await obterCredenciaisEvolution(ctx.env);
    const webhookUrl = urlWebhookEvolution(ctx.env);

    const instanceName = row.evolucaoNomeInstancia ?? `whasap-${row.uuid.slice(0, 8)}`;
    const instanceId = row.evolucaoInstanceId ?? row.uuid;
    const instanceToken = row.evolucaoToken ?? crypto.randomUUID().replace(/-/g, "");

    try {
      const meta = metaLogEvolution({ uuid: row.uuid, evolucaoInstanceId: instanceId });
      const admin = criarClienteEvolutionGo(ctx.env, { baseUrl, apiKey }, undefined, meta);
      if (!row.evolucaoInstanceId) {
        await admin.createInstance({ name: instanceName, instanceId, token: instanceToken });
      }
      const client = criarClienteEvolutionGo(
        ctx.env,
        { baseUrl, apiKey },
        { instanceToken },
        meta,
      );
      await client.connect({
        webhookUrl,
        subscribe: EVOLUTION_WEBHOOK_SUBSCRIBE_ALL,
      });
    } catch (err) {
      log.warn({
        evolution: {
          provisionFalhou: true,
          erro: err instanceof Error ? err.message : String(err),
        },
      });
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

  /** Encerra sessão de pareamento Evolution (timeout do QR) e volta para `pending_connection`. */
  encerrarPareamento: async (ctx: WebContext, input: { instanciaId: string }) => {
    exigirAutenticacao(ctx);
    const row = await buscarInstanciaDaOrganizacao(ctx, input.instanciaId);
    await exigirAcessoDemonstracao(ctx, row.organizacaoId);
    if (!isEvolutionProvider(row.provedor)) preconditionFailed("Instância não é Evolution");
    if (row.status !== "provisioning" && row.status !== "pending_connection") {
      preconditionFailed("Instância não está aguardando conexão");
    }

    if (row.evolucaoToken) {
      try {
        const creds = await obterCredenciaisEvolution(ctx.env);
        const client = criarClienteEvolutionGo(
          ctx.env,
          creds,
          { instanceToken: row.evolucaoToken },
          metaLogEvolution(row),
        );
        await client.disconnect();
      } catch (err) {
        log.warn({
          evolution: {
            encerrarPareamentoFalhou: true,
            erro: err instanceof Error ? err.message : String(err),
          },
        });
      }
    }

    await ctx.db
      .update(instancia)
      .set(comTimestampAtualizacao({ status: "pending_connection" }))
      .where(eq(instancia.id, row.id));

    return { ok: true };
  },

  /** Descarta instância em onboarding (soft-delete). Remove sessão Evolution no provedor. */
  descartar: async (ctx: WebContext, input: { instanciaId: string }) => {
    exigirAutenticacao(ctx);
    const row = await buscarInstanciaDaOrganizacao(ctx, input.instanciaId);
    await exigirAdminPorIdInterno(ctx, row.organizacaoId);
    await exigirAcessoDemonstracao(ctx, row.organizacaoId);

    if (row.status === "connected" || row.status === "deactivated") {
      preconditionFailed("Instância conectada ou desativada não pode ser descartada");
    }
    if (row.asaasIdAssinatura) {
      preconditionFailed("Instância com assinatura ativa não pode ser descartada");
    }

    if (isEvolutionProvider(row.provedor)) {
      const creds = await obterCredenciaisEvolution(ctx.env);
      if (row.evolucaoToken) {
        try {
          const client = criarClienteEvolutionGo(
          ctx.env,
          creds,
          { instanceToken: row.evolucaoToken },
          metaLogEvolution(row),
        );
          await client.disconnect();
        } catch (err) {
          log.warn({
            evolution: {
              descartarDisconnectFalhou: true,
              erro: err instanceof Error ? err.message : String(err),
            },
          });
        }
      }
      const evolutionId = row.evolucaoInstanceId ?? row.uuid;
      try {
        const admin = criarClienteEvolutionGo(ctx.env, creds, undefined, metaLogEvolution(row));
        await admin.deleteInstance(evolutionId);
      } catch (err) {
        log.warn({
          evolution: {
            descartarDeleteFalhou: true,
            erro: err instanceof Error ? err.message : String(err),
          },
        });
      }
    }

    await ctx.db
      .update(instancia)
      .set(marcarExclusaoLogica())
      .where(eq(instancia.id, row.id));

    return { ok: true };
  },

  obterQr: async (ctx: WebContext, input: { instanciaId: string }) => {
    exigirAutenticacao(ctx);
    const row = await buscarInstanciaDaOrganizacao(ctx, input.instanciaId);
    await exigirAcessoDemonstracao(ctx, row.organizacaoId);
    if (!isEvolutionProvider(row.provedor)) {
      preconditionFailed("Instância não pode ser provisionada");
    }

    if (!row.evolucaoToken) preconditionFailed("Instância não provisionada");

    const creds = await obterCredenciaisEvolution(ctx.env);
    const client = criarClienteEvolutionGo(
      ctx.env,
      creds,
      { instanceToken: row.evolucaoToken },
      metaLogEvolution(row),
    );

    let statusBruto: EvolutionGoStatusResponse;
    try {
      statusBruto = await client.getStatus();
    } catch (err) {
      return {
        base64: null,
        pairingCode: null,
        estado: "connecting",
        ...montarDebugEvolution(ctx.env, {
          erro: mensagemErroEvolution(err),
          statusHttp: statusHttpErroEvolution(err),
        }),
      };
    }

    const estado = parseGoConnectionState(statusBruto);

    try {
      const qrBruto = await client.getQrCode();
      const { base64, pairingCode } = parseGoQrResponse(qrBruto);
      return {
        base64,
        pairingCode,
        estado,
        ...montarDebugEvolution(ctx.env, { statusBruto, qrBruto }),
      };
    } catch (err) {
      return {
        base64: null,
        pairingCode: null,
        estado,
        ...montarDebugEvolution(ctx.env, {
          statusBruto,
          erro: mensagemErroEvolution(err),
          statusHttp: statusHttpErroEvolution(err),
        }),
      };
    }
  },

  statusConexao: async (ctx: WebContext, input: { instanciaId: string }) => {
    exigirAutenticacao(ctx);
    const row = await buscarInstanciaDaOrganizacao(ctx, input.instanciaId);
    await exigirAcessoDemonstracao(ctx, row.organizacaoId);

    if (row.provedor === "cloud_api") {
      const conectado = Boolean(
        row.nuvemIdNumeroTelefone && row.nuvemIdWaba && row.nuvemTokenAcesso,
      );
      if (conectado && row.status !== "connected") {
        await marcarInstanciaConectada(ctx, row.id, row.organizacaoId, row.asaasIdAssinatura);
      }
      return { estado: conectado ? "open" : "close", conectado };
    }

    if (!row.evolucaoToken) {
      return { estado: "close", conectado: false };
    }

    const creds = await obterCredenciaisEvolution(ctx.env);
    const client = criarClienteEvolutionGo(
      ctx.env,
      creds,
      { instanceToken: row.evolucaoToken },
      metaLogEvolution(row),
    );
    try {
      const statusBruto = await client.getStatus();
      const estado = parseGoConnectionState(statusBruto);
      const conectado = estado === "open";
      if (conectado && row.status !== "connected" && row.status !== "pending_payment") {
        await configurarWebhookInstanciaEvolution(ctx.env, row.evolucaoToken, metaLogEvolution(row));
        await marcarInstanciaConectada(ctx, row.id, row.organizacaoId, row.asaasIdAssinatura);
      }
      return {
        estado,
        conectado,
        ...montarDebugEvolution(ctx.env, { statusBruto }),
      };
    } catch (err) {
      return {
        estado: "connecting",
        conectado: false,
        ...montarDebugEvolution(ctx.env, {
          erro: mensagemErroEvolution(err),
          statusHttp: statusHttpErroEvolution(err),
        }),
      };
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
    await exigirAcessoDemonstracao(ctx, row.organizacaoId);

    const meta = createMetaClient({
      accessToken: input.accessToken,
      phoneNumberId: input.phoneNumberId,
      wabaId: input.wabaId,
    });

    let templatesCount: number;
    try {
      const templates = await meta.listTemplates();
      templatesCount = templates.data?.length ?? 0;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      log.warn({
        meta: {
          validacaoTokenFalhou: true,
          erro: msg,
        },
      });
      preconditionFailed(`Não foi possível sincronizar modelos da Meta: ${msg}`);
    }

    await ctx.db
      .update(instancia)
      .set(
        comTimestampAtualizacao({
          nuvemIdNumeroTelefone: input.phoneNumberId,
          nuvemIdWaba: input.wabaId,
          nuvemTokenAcesso: input.accessToken,
        }),
      )
      .where(eq(instancia.id, row.id));

    await marcarInstanciaConectada(ctx, row.id, row.organizacaoId, row.asaasIdAssinatura);

    return { ok: true, templatesCount };
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

    if (row.status !== "connected") {
      preconditionFailed("Conecte o WhatsApp antes de configurar o pagamento");
    }
    if (row.asaasIdAssinatura) {
      preconditionFailed("Esta instância já possui assinatura ativa");
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

    const trialDays = diasTrialAsaasRestantes(org);

    const urlCheckout = await createInstanceCheckout({
      env: ctx.env,
      customerId,
      customerData,
      instanceUuid: row.uuid,
      instanceName: row.nome,
      successUrl: `${ctx.env.WEB_URL}/${org.uuid}/ajustes`,
      cancelUrl: `${ctx.env.WEB_URL}/${org.uuid}/ajustes`,
      expiredUrl: `${ctx.env.WEB_URL}/${org.uuid}/ajustes`,
      trialDays,
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
    await exigirAcessoDemonstracao(ctx, row.organizacaoId);

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
            log.warn({
              asaas: {
                assinaturasLookupFalhou: true,
                erro: err instanceof Error ? err.message : String(err),
              },
            });
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
    await exigirAcessoDemonstracao(ctx, instance.organizacaoId);

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
