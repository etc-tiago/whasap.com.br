import { forbidden, notFound, preconditionFailed } from "@whasap/api-core";
import { cdnMediaUrl } from "@whasap/config";
import { createMetaClient } from "@whasap/meta";
import { appCreateData, resolveInternalId } from "@whasap/db";

import { getMetaCreds } from "./instancia";
import {
  cloudRequiresTemplate,
  isCloudWindowOpen,
  sendProviderMessage,
} from "../lib/messaging";
import type { WebContext } from "../types";
import { requireAuth, resolveMembershipInternal } from "./auth";
import type { MemberRole } from "../types";

async function getConversationByUuid(ctx: WebContext, conversaUuid: string) {
  const conversation = await ctx.client.conversa.findFirst({
    where: { uuid: conversaUuid },
    include: { instancia: true, contato: true },
  });
  if (!conversation?.instancia) return null;
  return { conversation, instance: conversation.instancia, contact: conversation.contato };
}

async function requireConversationAccess(ctx: WebContext, conversaUuid: string) {
  const conv = await getConversationByUuid(ctx, conversaUuid);
  if (!conv) notFound();
  const { role } = await resolveMembershipInternal(ctx, conv.instance.organizacaoId);
  return { ...conv, role };
}

async function requireInstanceAccess(ctx: WebContext, instanciaUuid: string) {
  const instance = await ctx.client.instancia.findFirst({
    where: { uuid: instanciaUuid },
  });
  if (!instance) notFound();
  const { role } = await resolveMembershipInternal(ctx, instance.organizacaoId);
  return { instance, role };
}

function assertCanWriteInbox(role: MemberRole) {
  if (role === "analista") forbidden();
}

function mapMessage(
  m: {
    uuid: string;
    direcao: string;
    tipo: string;
    corpo: string | null;
    midiaR2Chave?: string | null;
    status: string;
    templateNome: string | null;
    criadoEm: Date;
    enviadoPorUsuario?: { uuid: string; nome: string } | null;
  },
  cdnUrl?: string,
) {
  return {
    id: m.uuid,
    direction: m.direcao as "inbound" | "outbound",
    type: m.tipo,
    body: m.corpo,
    mediaUrl:
      m.midiaR2Chave && cdnUrl ? cdnMediaUrl(cdnUrl, m.midiaR2Chave) : null,
    enviadoPorUsuarioId: m.enviadoPorUsuario?.uuid ?? null,
    enviadoPorNome: m.enviadoPorUsuario?.nome ?? null,
    templateNome: m.templateNome,
    statusEntrega: m.status,
    criadoEm: m.criadoEm.toISOString(),
  };
}

export const caixaEntradaHandlers = {
  conversas: {
    lista: async (ctx: WebContext, input: { instanciaId: string }) => {
      requireAuth(ctx);
      const { instance } = await requireInstanceAccess(ctx, input.instanciaId);

      const rows = await ctx.client.conversa.findMany({
        where: { instanciaId: instance.id },
        include: { contato: true, atribuidoUsuario: true },
        orderBy: { ultimaMensagemEm: "desc" },
      });

      const result = [];
      for (const row of rows) {
        if (!row.contato) continue;
        const lastMsg = await ctx.client.mensagem.findFirst({
          where: { conversaId: row.id },
          orderBy: { criadoEm: "desc" },
        });
        result.push({
          id: row.uuid,
          instanciaId: instance.uuid,
          contatoId: row.contato.uuid,
          contatoNome: row.contato.nome,
          contatoTelefone: row.contato.telefone,
          usuarioAtribuidoId: row.atribuidoUsuario?.uuid ?? null,
          usuarioAtribuidoNome: row.atribuidoUsuario?.nome ?? null,
          status: row.status,
          janelaCloudExpiraEm: row.nuvemJanelaExpiraEm?.toISOString() ?? null,
          ultimaMensagemEm: row.ultimaMensagemEm?.toISOString() ?? null,
          ultimaMensagemPreview: lastMsg?.corpo ?? null,
        });
      }
      return result;
    },

    iniciar: async (
      ctx: WebContext,
      input: {
        instanciaId: string;
        telefone: string;
        nome?: string;
        corpo?: string;
        templateId?: string;
        variaveis?: Record<string, string>;
      },
    ) => {
      requireAuth(ctx);
      const { instance, role } = await requireInstanceAccess(ctx, input.instanciaId);
      assertCanWriteInbox(role);
      if (instance.status !== "connected") preconditionFailed("Instância não operacional");

      if (instance.provedor === "cloud_api" && !input.templateId) {
        preconditionFailed("Cloud API exige template para iniciar conversa");
      }
      if (instance.provedor === "evolution" && !input.corpo) {
        preconditionFailed("Informe a mensagem inicial");
      }

      const phone = input.telefone.replace(/\D/g, "");
      let contact = await ctx.client.contato.findFirst({
        where: { instanciaId: instance.id, telefone: phone },
      });
      if (!contact) {
        contact = await ctx.client.contato.create({
          data: appCreateData({
            instanciaId: instance.id,
            telefone: phone,
            nome: input.nome ?? null,
          }),
        });
      }

      const conversation = await ctx.client.conversa.create({
        data: appCreateData({
          instanciaId: instance.id,
          contatoId: contact.id,
          atribuidoUsuarioId: ctx.usuario!.internalId,
          ultimaMensagemEm: new Date(),
        }),
      });

      if (input.templateId) {
        const template = await ctx.client.mensagemTemplate.findFirst({
          where: { uuid: input.templateId },
        });
        if (!template) notFound("Template não encontrado");

        const externalId = await sendProviderMessage({
          ctx,
          instance,
          phone,
          type: "template",
          templateName: template.nome,
          templateLanguage: template.idioma,
          templateComponents: input.variaveis
            ? [
                {
                  type: "body",
                  parameters: Object.values(input.variaveis).map((text) => ({
                    type: "text",
                    text,
                  })),
                },
              ]
            : undefined,
        });

        await ctx.client.mensagem.create({
          data: appCreateData({
            conversaId: conversation.id,
            direcao: "outbound",
            tipo: "template",
            corpo: input.corpo ?? template.nome,
            templateNome: template.nome,
            templateIdioma: template.idioma,
            templateVariaveis: input.variaveis ?? null,
            idExterno: externalId,
            enviadoPorUsuarioId: ctx.usuario!.internalId,
          }),
        });
      } else if (input.corpo) {
        const externalId = await sendProviderMessage({
          ctx,
          instance,
          phone,
          type: "text",
          body: input.corpo,
        });
        await ctx.client.mensagem.create({
          data: appCreateData({
            conversaId: conversation.id,
            direcao: "outbound",
            tipo: "text",
            corpo: input.corpo,
            idExterno: externalId,
            enviadoPorUsuarioId: ctx.usuario!.internalId,
          }),
        });
      }

      return { conversaId: conversation.uuid };
    },

    atribuir: async (
      ctx: WebContext,
      input: { conversaId: string; usuarioId: string | null },
    ) => {
      requireAuth(ctx);
      const conv = await requireConversationAccess(ctx, input.conversaId);
      if (conv.role !== "admin" && conv.role !== "usuario") forbidden();

      let atribuidoUsuarioId: number | null = null;
      if (input.usuarioId) {
        atribuidoUsuarioId = await resolveInternalId(ctx.client, "usuario", input.usuarioId);
        if (atribuidoUsuarioId === null) notFound();
      }

      await ctx.client.conversa.update({
        where: { id: conv.conversation.id },
        data: { atribuidoUsuarioId },
      });
      return { ok: true };
    },

    fechar: async (ctx: WebContext, input: { conversaId: string }) => {
      requireAuth(ctx);
      const conv = await requireConversationAccess(ctx, input.conversaId);
      await ctx.client.conversa.update({
        where: { id: conv.conversation.id },
        data: { status: "closed", fechadoEm: new Date() },
      });
      return { ok: true };
    },
  },

  mensagens: {
    lista: async (ctx: WebContext, input: { conversaId: string }) => {
      requireAuth(ctx);
      const conv = await requireConversationAccess(ctx, input.conversaId);

      const rows = await ctx.client.mensagem.findMany({
        where: { conversaId: conv.conversation.id },
        include: { enviadoPorUsuario: true },
        orderBy: { criadoEm: "asc" },
      });

      return rows.map((m) => mapMessage(m, ctx.env.CDN_URL));
    },

    enviar: async (
      ctx: WebContext,
      input: {
        conversaId: string;
        body?: string;
        tipo?: string;
        mediaUrl?: string;
        mediaR2Key?: string;
        latitude?: number;
        longitude?: number;
        localNome?: string;
        localEndereco?: string;
      },
    ) => {
      requireAuth(ctx);
      const conv = await requireConversationAccess(ctx, input.conversaId);
      if (!conv.contact) notFound();

      assertCanWriteInbox(conv.role);
      if (conv.instance.status !== "connected") preconditionFailed("Instância não conectada");
      if (
        conv.role === "usuario" &&
        conv.conversation.atribuidoUsuarioId &&
        conv.conversation.atribuidoUsuarioId !== ctx.usuario!.internalId
      ) {
        forbidden("Conversa não atribuída a você");
      }

      const tipo = input.tipo ?? "text";
      if (
        cloudRequiresTemplate(
          conv.instance.provedor,
          conv.conversation.nuvemJanelaExpiraEm,
          false,
        ) &&
        tipo === "text" &&
        !isCloudWindowOpen(conv.conversation.nuvemJanelaExpiraEm)
      ) {
        preconditionFailed("Fora da janela de 24h — use um template");
      }

      const externalId = await sendProviderMessage({
        ctx,
        instance: conv.instance,
        phone: conv.contact.telefone,
        type: tipo,
        body: input.body,
        mediaUrl: input.mediaUrl,
        latitude: input.latitude,
        longitude: input.longitude,
        localNome: input.localNome,
        localEndereco: input.localEndereco,
      });

      const message = await ctx.client.mensagem.create({
        data: appCreateData({
          conversaId: conv.conversation.id,
          direcao: "outbound",
          tipo,
          corpo: input.body ?? null,
          midiaR2Chave: input.mediaR2Key ?? null,
          idExterno: externalId,
          enviadoPorUsuarioId: ctx.usuario!.internalId,
        }),
      });

      await ctx.client.conversa.update({
        where: { id: conv.conversation.id },
        data: { ultimaMensagemEm: new Date() },
      });

      const usuario = ctx.usuario!;
      return mapMessage(
        {
          ...message,
          enviadoPorUsuario: { uuid: usuario.id, nome: usuario.nome },
        },
        ctx.env.CDN_URL,
      );
    },

    enviarTemplate: async (
      ctx: WebContext,
      input: {
        conversaId: string;
        templateId: string;
        variaveis?: Record<string, string>;
      },
    ) => {
      requireAuth(ctx);
      const conv = await requireConversationAccess(ctx, input.conversaId);
      if (!conv.contact) notFound();
      assertCanWriteInbox(conv.role);

      const template = await ctx.client.mensagemTemplate.findFirst({
        where: { uuid: input.templateId },
      });
      if (!template) notFound("Template não encontrado");

      const externalId = await sendProviderMessage({
        ctx,
        instance: conv.instance,
        phone: conv.contact.telefone,
        type: "template",
        templateName: template.nome,
        templateLanguage: template.idioma,
        templateComponents: input.variaveis
          ? [
              {
                type: "body",
                parameters: Object.values(input.variaveis).map((text) => ({
                  type: "text",
                  text,
                })),
              },
            ]
          : undefined,
      });

      const message = await ctx.client.mensagem.create({
        data: appCreateData({
          conversaId: conv.conversation.id,
          direcao: "outbound",
          tipo: "template",
          corpo: template.nome,
          templateNome: template.nome,
          templateIdioma: template.idioma,
          templateVariaveis: input.variaveis ?? null,
          idExterno: externalId,
          enviadoPorUsuarioId: ctx.usuario!.internalId,
        }),
      });

      await ctx.client.conversa.update({
        where: { id: conv.conversation.id },
        data: { ultimaMensagemEm: new Date() },
      });

      const usuario = ctx.usuario!;
      return mapMessage(
        {
          ...message,
          enviadoPorUsuario: { uuid: usuario.id, nome: usuario.nome },
        },
        ctx.env.CDN_URL,
      );
    },
  },

  templates: {
    lista: async (ctx: WebContext, input: { instanciaId: string }) => {
      requireAuth(ctx);
      const { instance } = await requireInstanceAccess(ctx, input.instanciaId);

      const rows = await ctx.client.mensagemTemplate.findMany({
        where: { instanciaId: instance.id },
      });

      return rows.map((t) => ({
        id: t.uuid,
        nome: t.nome,
        idioma: t.idioma,
        categoria: t.categoria,
        status: t.status,
        componentes: t.componentes,
      }));
    },

    sincronizar: async (ctx: WebContext, input: { instanciaId: string }) => {
      requireAuth(ctx);
      const { instance } = await requireInstanceAccess(ctx, input.instanciaId);
      if (instance.provedor !== "cloud_api") preconditionFailed("Somente Cloud API");

      const creds = getMetaCreds(instance);
      const meta = createMetaClient(creds);
      const { data } = await meta.listTemplates();

      let count = 0;
      for (const tpl of data) {
        const existing = await ctx.client.mensagemTemplate.findFirst({
          where: {
            instanciaId: instance.id,
            nome: tpl.name,
            idioma: tpl.language,
          },
        });
        if (existing) {
          await ctx.client.mensagemTemplate.update({
            where: { id: existing.id },
            data: {
              categoria: tpl.category,
              status: tpl.status,
              componentes: tpl.components,
              idExterno: tpl.id,
              sincronizadoEm: new Date(),
            },
          });
        } else {
          await ctx.client.mensagemTemplate.create({
            data: appCreateData({
              instanciaId: instance.id,
              nome: tpl.name,
              idioma: tpl.language,
              categoria: tpl.category,
              status: tpl.status,
              componentes: tpl.components,
              idExterno: tpl.id,
              sincronizadoEm: new Date(),
            }),
          });
        }
        count++;
      }

      return { sincronizados: count };
    },
  },

  anotacoes: {
    lista: async (ctx: WebContext, input: { conversaId: string }) => {
      requireAuth(ctx);
      const conv = await requireConversationAccess(ctx, input.conversaId);

      const rows = await ctx.client.conversaAnotacao.findMany({
        where: { conversaId: conv.conversation.id },
        include: { autorUsuario: true },
        orderBy: { criadoEm: "asc" },
      });

      return rows
        .filter((r) => r.autorUsuario)
        .map((r) => ({
          id: r.uuid,
          body: r.corpo,
          autorUsuarioId: r.autorUsuario!.uuid,
          autorNome: r.autorUsuario!.nome,
          criadoEm: r.criadoEm.toISOString(),
        }));
    },

    criar: async (ctx: WebContext, input: { conversaId: string; body: string }) => {
      requireAuth(ctx);
      const conv = await requireConversationAccess(ctx, input.conversaId);
      assertCanWriteInbox(conv.role);

      const note = await ctx.client.conversaAnotacao.create({
        data: appCreateData({
          conversaId: conv.conversation.id,
          autorUsuarioId: ctx.usuario!.internalId,
          corpo: input.body,
        }),
      });
      return { id: note.uuid };
    },
  },
};
