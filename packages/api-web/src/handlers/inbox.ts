import { forbidden, notFound, preconditionFailed } from "@whasap/api-core";
import { createMetaClient } from "@whasap/meta";
import { appCreateData, resolveInternalId } from "@whasap/db";

import { getMetaCreds } from "./instancia";
import {
  cloudRequiresTemplate,
  isCloudWindowOpen,
  sendProviderMessage,
} from "../lib/messaging";
import type { WebContext } from "../types";
import { requireAuth, requireOrgInternal } from "./auth";

async function getConversationByUuid(ctx: WebContext, conversaUuid: string) {
  const conversation = await ctx.client.conversations.findFirst({
    where: { uuid: conversaUuid },
    include: { instance: true, contact: true },
  });
  if (!conversation?.instance) return null;
  return { conversation, instance: conversation.instance, contact: conversation.contact };
}

function mapMessage(
  m: {
    uuid: string;
    direction: string;
    type: string;
    body: string | null;
    status: string;
    templateName: string | null;
    criadoEm: Date;
    sentByUsuario?: { uuid: string; nome: string } | null;
  },
) {
  return {
    id: m.uuid,
    direction: m.direction as "inbound" | "outbound",
    type: m.type,
    body: m.body,
    enviadoPorUsuarioId: m.sentByUsuario?.uuid ?? null,
    enviadoPorNome: m.sentByUsuario?.nome ?? null,
    templateNome: m.templateName,
    statusEntrega: m.status,
    criadoEm: m.criadoEm.toISOString(),
  };
}

export const caixaEntradaHandlers = {
  conversas: {
    lista: async (ctx: WebContext, input: { instanciaId: string }) => {
      requireAuth(ctx);
      const instance = await ctx.client.instances.findFirst({
        where: { uuid: input.instanciaId },
      });
      if (!instance) notFound();
      requireOrgInternal(ctx, instance.organizationId);

      const rows = await ctx.client.conversations.findMany({
        where: { instanceId: instance.id },
        include: { contact: true, assignedUsuario: true },
        orderBy: { lastMessageAt: "desc" },
      });

      const result = [];
      for (const row of rows) {
        if (!row.contact) continue;
        const lastMsg = await ctx.client.messages.findFirst({
          where: { conversationId: row.id },
          orderBy: { criadoEm: "desc" },
        });
        result.push({
          id: row.uuid,
          instanciaId: instance.uuid,
          contatoId: row.contact.uuid,
          contatoNome: row.contact.name,
          contatoTelefone: row.contact.phone,
          usuarioAtribuidoId: row.assignedUsuario?.uuid ?? null,
          usuarioAtribuidoNome: row.assignedUsuario?.nome ?? null,
          status: row.status,
          janelaCloudExpiraEm: row.cloudWindowExpiresAt?.toISOString() ?? null,
          ultimaMensagemEm: row.lastMessageAt?.toISOString() ?? null,
          ultimaMensagemPreview: lastMsg?.body ?? null,
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
      if (ctx.role === "analista") forbidden();

      const instance = await ctx.client.instances.findFirst({
        where: { uuid: input.instanciaId },
      });
      if (!instance) notFound();
      requireOrgInternal(ctx, instance.organizationId);
      if (instance.status !== "connected") preconditionFailed("Instância não operacional");

      if (instance.provider === "cloud_api" && !input.templateId) {
        preconditionFailed("Cloud API exige template para iniciar conversa");
      }
      if (instance.provider === "evolution" && !input.corpo) {
        preconditionFailed("Informe a mensagem inicial");
      }

      const phone = input.telefone.replace(/\D/g, "");
      let contact = await ctx.client.contacts.findFirst({
        where: { instanceId: instance.id, phone },
      });
      if (!contact) {
        contact = await ctx.client.contacts.create({
          data: appCreateData({
            instanceId: instance.id,
            phone,
            name: input.nome ?? null,
          }),
        });
      }

      const conversation = await ctx.client.conversations.create({
        data: appCreateData({
          instanceId: instance.id,
          contactId: contact.id,
          assignedUsuarioId: ctx.usuario!.internalId,
          lastMessageAt: new Date(),
        }),
      });

      if (input.templateId) {
        const template = await ctx.client.messageTemplates.findFirst({
          where: { uuid: input.templateId },
        });
        if (!template) notFound("Template não encontrado");

        const externalId = await sendProviderMessage({
          ctx,
          instance,
          phone,
          type: "template",
          templateName: template.name,
          templateLanguage: template.language,
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

        await ctx.client.messages.create({
          data: appCreateData({
            conversationId: conversation.id,
            direction: "outbound",
            type: "template",
            body: input.corpo ?? template.name,
            templateName: template.name,
            templateLanguage: template.language,
            templateVariables: input.variaveis ?? null,
            externalId,
            sentByUsuarioId: ctx.usuario!.internalId,
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
        await ctx.client.messages.create({
          data: appCreateData({
            conversationId: conversation.id,
            direction: "outbound",
            type: "text",
            body: input.corpo,
            externalId,
            sentByUsuarioId: ctx.usuario!.internalId,
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
      const conv = await getConversationByUuid(ctx, input.conversaId);
      if (!conv) notFound();
      requireOrgInternal(ctx, conv.instance.organizationId);
      if (ctx.role !== "admin" && ctx.role !== "usuario") forbidden();

      let assignedUsuarioId: number | null = null;
      if (input.usuarioId) {
        assignedUsuarioId = await resolveInternalId(ctx.client, "usuario", input.usuarioId);
        if (assignedUsuarioId === null) notFound();
      }

      await ctx.client.conversations.update({
        where: { id: conv.conversation.id },
        data: { assignedUsuarioId },
      });
      return { ok: true };
    },

    fechar: async (ctx: WebContext, input: { conversaId: string }) => {
      requireAuth(ctx);
      const conv = await getConversationByUuid(ctx, input.conversaId);
      if (!conv) notFound();
      requireOrgInternal(ctx, conv.instance.organizationId);
      await ctx.client.conversations.update({
        where: { id: conv.conversation.id },
        data: { status: "closed", closedAt: new Date() },
      });
      return { ok: true };
    },
  },

  mensagens: {
    lista: async (ctx: WebContext, input: { conversaId: string }) => {
      requireAuth(ctx);
      const conv = await getConversationByUuid(ctx, input.conversaId);
      if (!conv) notFound();
      requireOrgInternal(ctx, conv.instance.organizationId);

      const rows = await ctx.client.messages.findMany({
        where: { conversationId: conv.conversation.id },
        include: { sentByUsuario: true },
        orderBy: { criadoEm: "asc" },
      });

      return rows.map((m) => mapMessage(m));
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
      const conv = await getConversationByUuid(ctx, input.conversaId);
      if (!conv || !conv.contact) notFound();
      requireOrgInternal(ctx, conv.instance.organizationId);

      if (ctx.role === "analista") forbidden();
      if (conv.instance.status !== "connected") preconditionFailed("Instância não conectada");
      if (
        ctx.role === "usuario" &&
        conv.conversation.assignedUsuarioId &&
        conv.conversation.assignedUsuarioId !== ctx.usuario!.internalId
      ) {
        forbidden("Conversa não atribuída a você");
      }

      const tipo = input.tipo ?? "text";
      if (
        cloudRequiresTemplate(
          conv.instance.provider,
          conv.conversation.cloudWindowExpiresAt,
          false,
        ) &&
        tipo === "text" &&
        !isCloudWindowOpen(conv.conversation.cloudWindowExpiresAt)
      ) {
        preconditionFailed("Fora da janela de 24h — use um template");
      }

      const externalId = await sendProviderMessage({
        ctx,
        instance: conv.instance,
        phone: conv.contact.phone,
        type: tipo,
        body: input.body,
        mediaUrl: input.mediaUrl,
        latitude: input.latitude,
        longitude: input.longitude,
        localNome: input.localNome,
        localEndereco: input.localEndereco,
      });

      const message = await ctx.client.messages.create({
        data: appCreateData({
          conversationId: conv.conversation.id,
          direction: "outbound",
          type: tipo,
          body: input.body ?? null,
          mediaR2Key: input.mediaR2Key ?? null,
          externalId,
          sentByUsuarioId: ctx.usuario!.internalId,
        }),
      });

      await ctx.client.conversations.update({
        where: { id: conv.conversation.id },
        data: { lastMessageAt: new Date() },
      });

      const usuario = ctx.usuario!;
      return mapMessage({
        ...message,
        sentByUsuario: { uuid: usuario.id, nome: usuario.nome },
      });
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
      const conv = await getConversationByUuid(ctx, input.conversaId);
      if (!conv || !conv.contact) notFound();
      requireOrgInternal(ctx, conv.instance.organizationId);
      if (ctx.role === "analista") forbidden();

      const template = await ctx.client.messageTemplates.findFirst({
        where: { uuid: input.templateId },
      });
      if (!template) notFound("Template não encontrado");

      const externalId = await sendProviderMessage({
        ctx,
        instance: conv.instance,
        phone: conv.contact.phone,
        type: "template",
        templateName: template.name,
        templateLanguage: template.language,
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

      const message = await ctx.client.messages.create({
        data: appCreateData({
          conversationId: conv.conversation.id,
          direction: "outbound",
          type: "template",
          body: template.name,
          templateName: template.name,
          templateLanguage: template.language,
          templateVariables: input.variaveis ?? null,
          externalId,
          sentByUsuarioId: ctx.usuario!.internalId,
        }),
      });

      await ctx.client.conversations.update({
        where: { id: conv.conversation.id },
        data: { lastMessageAt: new Date() },
      });

      const usuario = ctx.usuario!;
      return mapMessage({
        ...message,
        sentByUsuario: { uuid: usuario.id, nome: usuario.nome },
      });
    },
  },

  templates: {
    lista: async (ctx: WebContext, input: { instanciaId: string }) => {
      requireAuth(ctx);
      const instance = await ctx.client.instances.findFirst({
        where: { uuid: input.instanciaId },
      });
      if (!instance) notFound();
      requireOrgInternal(ctx, instance.organizationId);

      const rows = await ctx.client.messageTemplates.findMany({
        where: { instanceId: instance.id },
      });

      return rows.map((t) => ({
        id: t.uuid,
        nome: t.name,
        idioma: t.language,
        categoria: t.category,
        status: t.status,
        componentes: t.components,
      }));
    },

    sincronizar: async (ctx: WebContext, input: { instanciaId: string }) => {
      requireAuth(ctx);
      const instance = await ctx.client.instances.findFirst({
        where: { uuid: input.instanciaId },
      });
      if (!instance) notFound();
      requireOrgInternal(ctx, instance.organizationId);
      if (instance.provider !== "cloud_api") preconditionFailed("Somente Cloud API");

      const creds = await getMetaCreds(ctx, instance);
      const meta = createMetaClient(creds);
      const { data } = await meta.listTemplates();

      let count = 0;
      for (const tpl of data) {
        const existing = await ctx.client.messageTemplates.findFirst({
          where: {
            instanceId: instance.id,
            name: tpl.name,
            language: tpl.language,
          },
        });
        if (existing) {
          await ctx.client.messageTemplates.update({
            where: { id: existing.id },
            data: {
              category: tpl.category,
              status: tpl.status,
              components: tpl.components,
              externalId: tpl.id,
              syncedAt: new Date(),
            },
          });
        } else {
          await ctx.client.messageTemplates.create({
            data: appCreateData({
              instanceId: instance.id,
              name: tpl.name,
              language: tpl.language,
              category: tpl.category,
              status: tpl.status,
              components: tpl.components,
              externalId: tpl.id,
              syncedAt: new Date(),
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
      const conv = await getConversationByUuid(ctx, input.conversaId);
      if (!conv) notFound();
      requireOrgInternal(ctx, conv.instance.organizationId);

      const rows = await ctx.client.conversationNotes.findMany({
        where: { conversationId: conv.conversation.id },
        include: { authorUsuario: true },
        orderBy: { criadoEm: "asc" },
      });

      return rows
        .filter((r) => r.authorUsuario)
        .map((r) => ({
          id: r.uuid,
          body: r.body,
          autorUsuarioId: r.authorUsuario!.uuid,
          autorNome: r.authorUsuario!.nome,
          criadoEm: r.criadoEm.toISOString(),
        }));
    },

    criar: async (ctx: WebContext, input: { conversaId: string; body: string }) => {
      requireAuth(ctx);
      if (ctx.role === "analista") forbidden();
      const conv = await getConversationByUuid(ctx, input.conversaId);
      if (!conv) notFound();
      requireOrgInternal(ctx, conv.instance.organizationId);

      const note = await ctx.client.conversationNotes.create({
        data: appCreateData({
          conversationId: conv.conversation.id,
          authorUsuarioId: ctx.usuario!.internalId,
          body: input.body,
        }),
      });
      return { id: note.uuid };
    },
  },
};
