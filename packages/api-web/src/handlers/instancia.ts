import {
  criarClienteEvolutionGo,
  criarClienteMeta,
  getEvolutionCredentials,
  marcarInstanciaDesconectadaEvolution,
  notFound,
  preconditionFailed,
  solicitarHistoricoSyncEvolution,
} from "@whasap/api-core";
import {
  ICONE_CONEXAO_PADRAO,
  isEvoProvider,
  isMetaCloudProvider,
  type IconeConexao,
} from "@whasap/config";
import {
  colunasInstanciaPublica,
  colunasInstanciaUso,
  colunasOrganizacaoPublica,
  colunasSomenteId,
  colunasUsoMensal,
  comTimestampAtualizacao,
  comTimestampsCriacao,
  conversa,
  conversaAnotacao,
  incluirInstanciaOperacao,
  incluirOrganizacaoPublica,
  instancia,
  instanciaEvo,
  instanciaMetaCloud,
  marcarExclusaoLogica,
  mensagem,
  mensagemTemplate,
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
import { and, eq, inArray, isNull } from "drizzle-orm";

import {
  createAsaasFromEnv,
  createConversationPackCheckout,
  createInstanceCheckout,
  createOrgBaseCheckout,
  ensureAsaasCustomer,
} from "../lib/asaas";
import {
  diasTrialAsaasRestantes,
  exigirAcessoDemonstracao,
  marcarInstanciaConectada,
} from "../lib/demonstracao";
import {
  configurarWebhookInstanciaEvolution,
  obterQrComSessao,
  urlWebhookEvolution,
} from "../lib/evolution-webhook";
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
    columns: incluirInstanciaOperacao.columns,
    with: {
      organizacao: incluirOrganizacaoPublica,
      evo: incluirInstanciaOperacao.with.evo,
      metaCloud: incluirInstanciaOperacao.with.metaCloud,
    },
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

function metaLogEvolution(
  row: { uuid: string; evo?: { instanceId?: string | null } | null; status?: string },
  ctx: { origem: string; rpc: string },
) {
  return {
    instanciaUuid: row.uuid,
    ...(row.evo?.instanceId ? { evolutionInstanceId: row.evo.instanceId } : {}),
    ...(row.status ? { dbStatus: row.status } : {}),
    origem: ctx.origem,
    rpc: ctx.rpc,
  };
}

/** Soft-delete conversas, mensagens, anotações e templates da instância. */
async function softDeleteDadosRelacionadosInstancia(
  db: WebContext["db"],
  instanciaIdInterno: number,
) {
  const conversas = await db.query.conversa.findMany({
    where: and(eq(conversa.instanciaId, instanciaIdInterno), isNull(conversa.excluidoEm)),
    columns: colunasSomenteId,
  });
  const conversaIds = conversas.map((c) => c.id);

  if (conversaIds.length > 0) {
    await db
      .update(mensagem)
      .set(marcarExclusaoLogica())
      .where(and(inArray(mensagem.conversaId, conversaIds), isNull(mensagem.excluidoEm)));
    await db
      .update(conversaAnotacao)
      .set(marcarExclusaoLogica())
      .where(
        and(inArray(conversaAnotacao.conversaId, conversaIds), isNull(conversaAnotacao.excluidoEm)),
      );
    await db
      .update(conversa)
      .set(comTimestampAtualizacao(marcarExclusaoLogica()))
      .where(inArray(conversa.id, conversaIds));
  }

  await db
    .update(mensagemTemplate)
    .set(comTimestampAtualizacao(marcarExclusaoLogica()))
    .where(
      and(
        eq(mensagemTemplate.instanciaId, instanciaIdInterno),
        isNull(mensagemTemplate.excluidoEm),
      ),
    );
}

/** Disconnect + opcional delete remoto Evolution (best-effort). */
async function encerrarSessaoEvolutionRemota(
  ctx: WebContext,
  row: Awaited<ReturnType<typeof buscarInstanciaDaOrganizacao>>,
  opts: { origem: string; rpc: string; excluirInstanciaRemota: boolean },
) {
  if (!isEvoProvider(row.provedor)) return;
  const creds = await obterCredenciaisEvolution(ctx.env);
  if (row.evo?.token) {
    try {
      const client = criarClienteEvolutionGo(
        ctx.env,
        creds,
        { instanceToken: row.evo.token },
        metaLogEvolution(row, { origem: opts.origem, rpc: opts.rpc }),
      );
      await client.disconnect();
    } catch (err) {
      log.warn({
        evolution: {
          desconectarDisconnectFalhou: true,
          erro: err instanceof Error ? err.message : String(err),
        },
      });
    }
  }
  if (!opts.excluirInstanciaRemota) return;
  const evolutionId = row.evo?.instanceId ?? row.uuid;
  try {
    const admin = criarClienteEvolutionGo(
      ctx.env,
      creds,
      undefined,
      metaLogEvolution(row, { origem: opts.origem, rpc: opts.rpc }),
    );
    await admin.deleteInstance(evolutionId);
  } catch (err) {
    log.warn({
      evolution: {
        desconectarDeleteFalhou: true,
        erro: err instanceof Error ? err.message : String(err),
      },
    });
  }
}

/** Obtém credenciais Meta Cloud API da instância. */
export function obterCredenciaisMeta(instance: {
  metaCloud?: {
    accessToken: string | null;
    phoneNumberId: string | null;
    wabaId: string | null;
  } | null;
}) {
  const meta = instance.metaCloud;
  if (!meta?.accessToken || !meta.phoneNumberId || !meta.wabaId) {
    preconditionFailed("Credenciais Meta não configuradas");
  }
  return {
    accessToken: meta.accessToken,
    phoneNumberId: meta.phoneNumberId,
    wabaId: meta.wabaId,
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
      columns: incluirInstanciaOperacao.columns,
      with: {
        evo: incluirInstanciaOperacao.with.evo,
        metaCloud: incluirInstanciaOperacao.with.metaCloud,
      },
    });
    return rows.map((instance) => toInstanciaOutput(instance, org.uuid));
  },

  /** Cria instância em `pending_connection` (somente admin). */
  criar: async (
    ctx: WebContext,
    input: {
      organizacaoHash: string;
      nome: string;
      icone?: IconeConexao;
      provider: "evo" | "meta_cloud";
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
          icone: input.icone ?? ICONE_CONEXAO_PADRAO,
          provedor: input.provider,
          status: "pending_connection",
          limiteConversas: 0,
        }),
      )
      .returning();

    return toInstanciaOutput(instance!, org.uuid);
  },

  /** Atualiza nome e/ou ícone da conexão (somente admin). */
  atualizar: async (
    ctx: WebContext,
    input: {
      instanciaId: string;
      nome?: string;
      icone?: IconeConexao;
    },
  ) => {
    exigirAutenticacao(ctx);
    const row = await buscarInstanciaDaOrganizacao(ctx, input.instanciaId);
    await exigirAdminPorIdInterno(ctx, row.organizacaoId);
    await exigirAcessoDemonstracao(ctx, row.organizacaoId);

    const patch: { nome?: string; icone?: string } = {};
    if (input.nome !== undefined) patch.nome = input.nome;
    if (input.icone !== undefined) patch.icone = input.icone;
    if (Object.keys(patch).length === 0) preconditionFailed("Informe nome e/ou ícone");

    const [updated] = await ctx.db
      .update(instancia)
      .set(comTimestampAtualizacao(patch))
      .where(eq(instancia.id, row.id))
      .returning();

    return toInstanciaOutput(
      { ...row, ...updated!, evo: row.evo, metaCloud: row.metaCloud },
      row.organizacao!.uuid,
    );
  },

  provisionar: async (ctx: WebContext, input: { instanciaId: string }) => {
    exigirAutenticacao(ctx);
    const row = await buscarInstanciaDaOrganizacao(ctx, input.instanciaId);
    await exigirAcessoDemonstracao(ctx, row.organizacaoId);
    if (!isEvoProvider(row.provedor)) preconditionFailed("Instância não é Evolution");
    if (
      row.status !== "pending_connection" &&
      row.status !== "provisioning" &&
      row.status !== "disconnected"
    ) {
      preconditionFailed("Instância já provisionada");
    }

    const { baseUrl, apiKey } = await obterCredenciaisEvolution(ctx.env);
    const webhookUrl = urlWebhookEvolution(ctx.env);

    const instanceName = row.evo?.nomeInstancia ?? `whasap-${row.uuid.slice(0, 8)}`;
    const instanceId = row.evo?.instanceId ?? row.uuid;
    const instanceToken = row.evo?.token ?? crypto.randomUUID().replace(/-/g, "");

    const rowMeta = { uuid: row.uuid, evo: { instanceId }, status: row.status };

    try {
      const meta = metaLogEvolution(rowMeta, {
        origem: "provisionar",
        rpc: "instancia.provisionar",
      });
      const admin = criarClienteEvolutionGo(ctx.env, { baseUrl, apiKey }, undefined, meta);
      if (!row.evo?.instanceId) {
        await admin.createInstance({ name: instanceName, instanceId, token: instanceToken });
      }
      const client = criarClienteEvolutionGo(ctx.env, { baseUrl, apiKey }, { instanceToken }, meta);
      await client.connect({
        webhookUrl,
        subscribe: EVOLUTION_WEBHOOK_SUBSCRIBE_ALL,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      log.warn({
        evolution: {
          provisionFalhou: true,
          erro: msg,
        },
      });
      preconditionFailed(`Não foi possível provisionar a instância: ${msg}`);
    }

    await ctx.db
      .update(instancia)
      .set(
        comTimestampAtualizacao({
          status: "provisioning",
          tentativasProvisionamento: row.tentativasProvisionamento + 1,
        }),
      )
      .where(eq(instancia.id, row.id));

    await ctx.db
      .insert(instanciaEvo)
      .values(
        comTimestampsCriacao({
          instanciaId: row.id,
          nomeInstancia: instanceName,
          instanceId,
          token: instanceToken,
        }),
      )
      .onConflictDoUpdate({
        target: instanciaEvo.instanciaId,
        set: comTimestampAtualizacao({
          nomeInstancia: instanceName,
          instanceId,
          token: instanceToken,
        }),
      });

    return { ok: true };
  },

  /** Encerra sessão de pareamento Evolution (timeout do QR) e volta para `pending_connection`. */
  encerrarPareamento: async (ctx: WebContext, input: { instanciaId: string }) => {
    exigirAutenticacao(ctx);
    const row = await buscarInstanciaDaOrganizacao(ctx, input.instanciaId);
    await exigirAcessoDemonstracao(ctx, row.organizacaoId);
    if (!isEvoProvider(row.provedor)) preconditionFailed("Instância não é Evolution");
    if (
      row.status !== "provisioning" &&
      row.status !== "pending_connection" &&
      row.status !== "disconnected"
    ) {
      preconditionFailed("Instância não está aguardando conexão");
    }

    if (row.evo?.token) {
      try {
        const creds = await obterCredenciaisEvolution(ctx.env);
        const client = criarClienteEvolutionGo(
          ctx.env,
          creds,
          { instanceToken: row.evo.token },
          metaLogEvolution(row, {
            origem: "encerrarPareamento",
            rpc: "instancia.encerrarPareamento",
          }),
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

    if (isEvoProvider(row.provedor)) {
      const creds = await obterCredenciaisEvolution(ctx.env);
      if (row.evo?.token) {
        try {
          const client = criarClienteEvolutionGo(
            ctx.env,
            creds,
            { instanceToken: row.evo.token },
            metaLogEvolution(row, { origem: "descartar", rpc: "instancia.descartar" }),
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
      const evolutionId = row.evo?.instanceId ?? row.uuid;
      try {
        const admin = criarClienteEvolutionGo(
          ctx.env,
          creds,
          undefined,
          metaLogEvolution(row, { origem: "descartar", rpc: "instancia.descartar" }),
        );
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

    await ctx.db.update(instancia).set(marcarExclusaoLogica()).where(eq(instancia.id, row.id));

    return { ok: true };
  },

  /**
   * Desconecta o WhatsApp da instância.
   * Com `excluirDados`, soft-delete conversas/mensagens; sem assinatura, também remove a conexão do painel.
   */
  desconectar: async (ctx: WebContext, input: { instanciaId: string; excluirDados?: boolean }) => {
    exigirAutenticacao(ctx);
    const row = await buscarInstanciaDaOrganizacao(ctx, input.instanciaId);
    await exigirAdminPorIdInterno(ctx, row.organizacaoId);
    await exigirAcessoDemonstracao(ctx, row.organizacaoId);

    if (row.status === "deactivated") {
      preconditionFailed("Instância desativada não pode ser desconectada");
    }

    const excluirDados = Boolean(input.excluirDados);
    const operacional = row.status === "connected" || row.status === "pending_payment";
    const removerDoPainel = excluirDados && !row.asaasIdAssinatura;

    if (!operacional && !excluirDados) {
      preconditionFailed("Instância já está desconectada");
    }

    if (operacional || removerDoPainel) {
      await encerrarSessaoEvolutionRemota(ctx, row, {
        origem: "desconectar",
        rpc: "instancia.desconectar",
        excluirInstanciaRemota: removerDoPainel,
      });
    }

    if (excluirDados) {
      await softDeleteDadosRelacionadosInstancia(ctx.db, row.id);
    }

    if (removerDoPainel) {
      await ctx.db.update(instancia).set(marcarExclusaoLogica()).where(eq(instancia.id, row.id));
      return { ok: true };
    }

    if (operacional) {
      await marcarInstanciaDesconectadaEvolution(ctx.db, row.id);
    }

    return { ok: true };
  },

  obterQr: async (ctx: WebContext, input: { instanciaId: string }) => {
    exigirAutenticacao(ctx);
    const row = await buscarInstanciaDaOrganizacao(ctx, input.instanciaId);
    await exigirAcessoDemonstracao(ctx, row.organizacaoId);
    if (!isEvoProvider(row.provedor)) {
      preconditionFailed("Instância não pode ser provisionada");
    }

    if (!row.evo?.token) preconditionFailed("Instância não provisionada");

    const creds = await obterCredenciaisEvolution(ctx.env);
    const client = criarClienteEvolutionGo(
      ctx.env,
      creds,
      { instanceToken: row.evo.token },
      metaLogEvolution(row, { origem: "obterQr", rpc: "instancia.obterQr" }),
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

    if (estado === "open") {
      if (row.status !== "connected" && row.status !== "pending_payment") {
        await configurarWebhookInstanciaEvolution(
          ctx.env,
          row.evo.token,
          metaLogEvolution(row, { origem: "obterQr", rpc: "instancia.obterQr" }),
        );
        await marcarInstanciaConectada(ctx, row.id, row.organizacaoId, row.asaasIdAssinatura);
      }
      return {
        base64: null,
        pairingCode: null,
        estado,
        ...montarDebugEvolution(ctx.env, { statusBruto }),
      };
    }

    if (estado === "close") {
      if (row.status === "connected" || row.status === "pending_payment") {
        await marcarInstanciaDesconectadaEvolution(ctx.db, row.id);
      }

      const qr = await obterQrComSessao(client, ctx.env);
      return {
        base64: qr.base64,
        pairingCode: qr.pairingCode,
        estado: "connecting",
        ...montarDebugEvolution(ctx.env, {
          statusBruto,
          ...(qr.qrBruto ? { qrBruto: qr.qrBruto } : {}),
          ...(qr.erro ? { erro: qr.erro } : {}),
        }),
      };
    }

    // connecting: tenta QR direto; se vazio/erro, connect + retry (GO às vezes reporta
    // connecting sem sessão de pareamento real).
    try {
      const qrBruto = await client.getQrCode();
      const { base64, pairingCode } = parseGoQrResponse(qrBruto);
      if (base64 || pairingCode) {
        return {
          base64,
          pairingCode,
          estado,
          ...montarDebugEvolution(ctx.env, { statusBruto, qrBruto }),
        };
      }
    } catch {
      // cai no obterQrComSessao abaixo
    }

    const qr = await obterQrComSessao(client, ctx.env);
    return {
      base64: qr.base64,
      pairingCode: qr.pairingCode,
      estado: "connecting",
      ...montarDebugEvolution(ctx.env, {
        statusBruto,
        ...(qr.qrBruto ? { qrBruto: qr.qrBruto } : {}),
        ...(qr.erro ? { erro: qr.erro } : {}),
      }),
    };
  },

  statusConexao: async (ctx: WebContext, input: { instanciaId: string }) => {
    exigirAutenticacao(ctx);
    const row = await buscarInstanciaDaOrganizacao(ctx, input.instanciaId);
    await exigirAcessoDemonstracao(ctx, row.organizacaoId);

    if (isMetaCloudProvider(row.provedor)) {
      const conectado = Boolean(
        row.metaCloud?.phoneNumberId && row.metaCloud?.wabaId && row.metaCloud?.accessToken,
      );
      if (conectado && row.status !== "connected") {
        await marcarInstanciaConectada(ctx, row.id, row.organizacaoId, row.asaasIdAssinatura);
      }
      return { estado: conectado ? "open" : "close", conectado };
    }

    if (!row.evo?.token) {
      return { estado: "close", conectado: false };
    }

    const creds = await obterCredenciaisEvolution(ctx.env);
    const client = criarClienteEvolutionGo(
      ctx.env,
      creds,
      { instanceToken: row.evo.token },
      metaLogEvolution(row, { origem: "statusConexao", rpc: "instancia.statusConexao" }),
    );
    try {
      const statusBruto = await client.getStatus();
      const estado = parseGoConnectionState(statusBruto);
      const conectado = estado === "open";
      if (conectado && row.status !== "connected" && row.status !== "pending_payment") {
        await configurarWebhookInstanciaEvolution(
          ctx.env,
          row.evo.token,
          metaLogEvolution(row, { origem: "statusConexao", rpc: "instancia.statusConexao" }),
        );
        await marcarInstanciaConectada(ctx, row.id, row.organizacaoId, row.asaasIdAssinatura);
      } else if (
        estado === "close" &&
        (row.status === "connected" || row.status === "pending_payment")
      ) {
        await marcarInstanciaDesconectadaEvolution(ctx.db, row.id);
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
    if (!isMetaCloudProvider(row.provedor)) preconditionFailed("Instância não é Cloud API");
    await exigirAdminPorIdInterno(ctx, row.organizacaoId);
    await exigirAcessoDemonstracao(ctx, row.organizacaoId);

    const meta = criarClienteMeta(
      ctx.env,
      {
        accessToken: input.accessToken,
        phoneNumberId: input.phoneNumberId,
        wabaId: input.wabaId,
      },
      {
        origem: "configurarCloud",
        rpc: "instancia.configurarCloud",
        instanciaUuid: row.uuid,
      },
    );

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
      .insert(instanciaMetaCloud)
      .values(
        comTimestampsCriacao({
          instanciaId: row.id,
          phoneNumberId: input.phoneNumberId,
          wabaId: input.wabaId,
          accessToken: input.accessToken,
        }),
      )
      .onConflictDoUpdate({
        target: instanciaMetaCloud.instanciaId,
        set: comTimestampAtualizacao({
          phoneNumberId: input.phoneNumberId,
          wabaId: input.wabaId,
          accessToken: input.accessToken,
        }),
      });

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
    const urlsBase = {
      successUrl: `${ctx.env.WEB_URL}/${org.uuid}/ajustes`,
      cancelUrl: `${ctx.env.WEB_URL}/${org.uuid}/ajustes`,
      expiredUrl: `${ctx.env.WEB_URL}/${org.uuid}/ajustes`,
    };

    // Sem taxa base da org: cobra a base primeiro; conexão no próximo checkout.
    if (!org.asaasIdAssinaturaBase) {
      const urlCheckout = await createOrgBaseCheckout({
        env: ctx.env,
        customerId,
        customerData,
        organizacaoUuid: org.uuid,
        organizacaoNome: org.nome,
        ...urlsBase,
        trialDays,
      });
      return { urlCheckout };
    }

    const urlCheckout = await createInstanceCheckout({
      env: ctx.env,
      customerId,
      customerData,
      instanceUuid: row.uuid,
      instanceName: row.nome,
      ...urlsBase,
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

  /** Dispara sincronização de histórico via Evolution GO (WhatsApp Comercial). */
  sincronizarHistorico: async (ctx: WebContext, input: { instanciaId: string }) => {
    exigirAutenticacao(ctx);
    const row = await buscarInstanciaDaOrganizacao(ctx, input.instanciaId);
    await exigirAcessoDemonstracao(ctx, row.organizacaoId);

    if (!isEvoProvider(row.provedor)) {
      preconditionFailed("Sincronização de histórico disponível apenas para WhatsApp Comercial");
    }
    if (row.status !== "connected" && row.status !== "pending_payment") {
      preconditionFailed("Instância precisa estar conectada para sincronizar histórico");
    }

    const result = await solicitarHistoricoSyncEvolution(
      ctx.db,
      ctx.env,
      {
        id: row.id,
        uuid: row.uuid,
        evo: row.evo
          ? {
              token: row.evo.token,
              historicoSincronizadoEm: row.evo.historicoSincronizadoEm,
              historicoSincronizandoEm: row.evo.historicoSincronizandoEm,
              historicoSyncStatus: row.evo.historicoSyncStatus,
            }
          : null,
      },
      { forcar: false },
    );
    if (!result.ok) {
      preconditionFailed(result.motivo ?? "Não foi possível iniciar a sincronização");
    }

    return { ok: true };
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

    const org = await ctx.db.query.organizacao.findFirst({
      where: and(eq(organizacao.id, instance.organizacaoId), isNull(organizacao.excluidoEm)),
      columns: { limiteConversas: true },
    });
    if (!org) notFound();

    const anoMes = new Date().toISOString().slice(0, 7);
    const instanciasOrg = await ctx.db.query.instancia.findMany({
      where: and(eq(instancia.organizacaoId, instance.organizacaoId), isNull(instancia.excluidoEm)),
      columns: { id: true },
    });
    const instanceIds = instanciasOrg.map((i) => i.id);

    let count = 0;
    if (instanceIds.length > 0) {
      const usages = await ctx.db.query.usoMensal.findMany({
        where: and(inArray(usoMensal.instanciaId, instanceIds), eq(usoMensal.anoMes, anoMes)),
        columns: colunasUsoMensal,
      });
      count = usages.reduce((sum, u) => sum + (u.contatosUnicosContagem ?? 0), 0);
    }

    const limiteConversas = org.limiteConversas;
    return {
      anoMes,
      contatosUnicos: count,
      limiteConversas,
      nivelAlerta: nivelAlerta(count, limiteConversas),
    };
  },
};
