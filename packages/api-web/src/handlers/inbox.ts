import { and, asc, desc, eq, isNull } from "drizzle-orm";
import { forbidden, notFound, preconditionFailed } from "@whasap/api-core";
import { isEvolutionProvider } from "@whasap/config";
import { cdnMediaUrl } from "@whasap/config";
import { createMetaClient, type MetaTemplate } from "@whasap/meta";
import {
  contato,
  conversa,
  conversaAnotacao,
  colunasContatoCaixaEntrada,
  colunasConversaAnotacao,
  colunasConversaComRelacoes,
  colunasConversaLista,
  colunasInstanciaOperacao,
  colunasMensagemLista,
  colunasMensagemPreview,
  colunasMensagemTemplate,
  colunasSomenteId,
  comCriadoEm,
  comTimestampsCriacao,
  comTimestampAtualizacao,
  incluirContatoCaixaEntrada,
  incluirInstanciaOperacao,
  incluirUsuarioRelacao,
  instancia,
  mensagem,
  mensagemTemplate,
  resolverIdInterno,
} from "@whasap/db";

import { obterCredenciaisMeta } from "./instancia";
import {
  assertMessageTypeSupported,
  cloudRequiresTemplate,
  isCloudWindowOpen,
  markProviderMessageRead,
  sendProviderMessage,
} from "../lib/messaging";
import type { WebContext } from "../types";
import { exigirAutenticacao, resolverMembroPorIdInterno } from "./auth";
import { exigirAcessoDemonstracao } from "../lib/demonstracao";
import { isInstanceOperational } from "../lib/instance-operational";
import type { MemberRole } from "../types";

/**
 * Busca conversa ativa com instância e contato relacionados.
 * @returns `null` se não encontrada ou instância ausente.
 */
async function buscarConversaPorUuid(ctx: WebContext, conversaUuid: string) {
  const conversation = await ctx.db.query.conversa.findFirst({
    where: and(eq(conversa.uuid, conversaUuid), isNull(conversa.excluidoEm)),
    columns: colunasConversaComRelacoes,
    with: {
      instancia: incluirInstanciaOperacao,
      contato: incluirContatoCaixaEntrada,
    },
  });
  if (!conversation?.instancia) return null;
  return { conversation, instance: conversation.instancia, contact: conversation.contato };
}

/**
 * Exige que o usuário seja membro da org da conversa.
 * @throws 404 se a conversa não existir.
 */
async function exigirAcessoConversa(ctx: WebContext, conversaUuid: string) {
  const conv = await buscarConversaPorUuid(ctx, conversaUuid);
  if (!conv) notFound();
  const { role } = await resolverMembroPorIdInterno(ctx, conv.instance.organizacaoId);
  await exigirAcessoDemonstracao(ctx, conv.instance.organizacaoId);
  return { ...conv, role };
}

/** Exige que o usuário seja membro da org dona da instância. */
async function exigirAcessoInstancia(ctx: WebContext, instanciaUuid: string) {
  const instance = await ctx.db.query.instancia.findFirst({
    where: and(eq(instancia.uuid, instanciaUuid), isNull(instancia.excluidoEm)),
    columns: colunasInstanciaOperacao,
  });
  if (!instance) notFound();
  const { role } = await resolverMembroPorIdInterno(ctx, instance.organizacaoId);
  await exigirAcessoDemonstracao(ctx, instance.organizacaoId);
  return { instance, role };
}

/** Analistas têm acesso somente leitura na caixa de entrada. */
function verificarPodeEscreverCaixaEntrada(role: MemberRole) {
  if (role === "analista") forbidden();
}

function mapearMensagemParaSaida(
  m: {
    uuid: string;
    idExterno?: string | null;
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
    idExterno: m.idExterno ?? null,
    direction: m.direcao as "inbound" | "outbound",
    type: m.tipo,
    body: m.corpo,
    mediaUrl: m.midiaR2Chave && cdnUrl ? cdnMediaUrl(cdnUrl, m.midiaR2Chave) : null,
    enviadoPorUsuarioId: m.enviadoPorUsuario?.uuid ?? null,
    enviadoPorNome: m.enviadoPorUsuario?.nome ?? null,
    templateNome: m.templateNome,
    statusEntrega: m.status,
    criadoEm: m.criadoEm.toISOString(),
  };
}

async function sincronizarTemplateMeta(
  ctx: WebContext,
  instanciaId: number,
  tpl: MetaTemplate,
): Promise<void> {
  const existing = await ctx.db.query.mensagemTemplate.findFirst({
    where: and(
      eq(mensagemTemplate.instanciaId, instanciaId),
      eq(mensagemTemplate.nome, tpl.name),
      eq(mensagemTemplate.idioma, tpl.language),
      isNull(mensagemTemplate.excluidoEm),
    ),
    columns: colunasSomenteId,
  });
  if (existing) {
    await ctx.db
      .update(mensagemTemplate)
      .set(
        comTimestampAtualizacao({
          categoria: tpl.category,
          status: tpl.status,
          componentes: tpl.components,
          idExterno: tpl.id,
          sincronizadoEm: new Date(),
        }),
      )
      .where(eq(mensagemTemplate.id, existing.id));
    return;
  }

  await ctx.db.insert(mensagemTemplate).values(
    comTimestampsCriacao({
      instanciaId,
      nome: tpl.name,
      idioma: tpl.language,
      categoria: tpl.category,
      status: tpl.status,
      componentes: tpl.components,
      idExterno: tpl.id,
      sincronizadoEm: new Date(),
    }),
  );
}

/**
 * Handlers da caixa de entrada: conversas, mensagens, templates e anotações.
 * Analistas têm acesso somente leitura; admin e usuario podem enviar mensagens.
 */
export const caixaEntradaHandlers = {
  conversas: {
    lista: async (ctx: WebContext, input: { instanciaId: string }) => {
      exigirAutenticacao(ctx);
      const { instance } = await exigirAcessoInstancia(ctx, input.instanciaId);

      const rows = await ctx.db.query.conversa.findMany({
        where: and(eq(conversa.instanciaId, instance.id), isNull(conversa.excluidoEm)),
        columns: colunasConversaLista,
        with: {
          contato: incluirContatoCaixaEntrada,
          atribuidoUsuario: incluirUsuarioRelacao,
        },
        orderBy: [desc(conversa.ultimaMensagemEm)],
      });

      const rowsWithContato = rows.filter((row) => row.contato);

      return Promise.all(
        rowsWithContato.map(async (row) => {
          const contatoRow = row.contato!;
          const lastMsg = await ctx.db.query.mensagem.findFirst({
            where: and(eq(mensagem.conversaId, row.id), isNull(mensagem.excluidoEm)),
            columns: colunasMensagemPreview,
            orderBy: [desc(mensagem.criadoEm)],
          });
          return {
            id: row.uuid,
            instanciaId: instance.uuid,
            contatoId: contatoRow.uuid,
            contatoNome: contatoRow.nome,
            contatoTelefone: contatoRow.telefone,
            usuarioAtribuidoId: row.atribuidoUsuario?.uuid ?? null,
            usuarioAtribuidoNome: row.atribuidoUsuario?.nome ?? null,
            status: row.status,
            janelaCloudExpiraEm: row.nuvemJanelaExpiraEm?.toISOString() ?? null,
            ultimaMensagemEm: row.ultimaMensagemEm?.toISOString() ?? null,
            ultimaMensagemPreview: lastMsg?.corpo ?? null,
          };
        }),
      );
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
      exigirAutenticacao(ctx);
      const { instance, role } = await exigirAcessoInstancia(ctx, input.instanciaId);
      verificarPodeEscreverCaixaEntrada(role);
      if (!isInstanceOperational(instance)) preconditionFailed("Instância não operacional");

      if (instance.provedor === "cloud_api" && !input.templateId) {
        preconditionFailed("Cloud API exige template para iniciar conversa");
      }
      if (isEvolutionProvider(instance.provedor) && !input.corpo) {
        preconditionFailed("Informe a mensagem inicial");
      }

      const phone = input.telefone.replace(/\D/g, "");
      let contact = await ctx.db.query.contato.findFirst({
        where: and(
          eq(contato.instanciaId, instance.id),
          eq(contato.telefone, phone),
          isNull(contato.excluidoEm),
        ),
        columns: colunasContatoCaixaEntrada,
      });
      if (!contact) {
        [contact] = await ctx.db
          .insert(contato)
          .values(
            comTimestampsCriacao({
              instanciaId: instance.id,
              telefone: phone,
              nome: input.nome ?? null,
            }),
          )
          .returning();
      }

      const [conversation] = await ctx.db
        .insert(conversa)
        .values(
          comTimestampsCriacao({
            instanciaId: instance.id,
            contatoId: contact!.id,
            atribuidoUsuarioId: ctx.usuario!.internalId,
            ultimaMensagemEm: new Date(),
          }),
        )
        .returning();

      if (input.templateId) {
        const template = await ctx.db.query.mensagemTemplate.findFirst({
          where: and(
            eq(mensagemTemplate.uuid, input.templateId),
            isNull(mensagemTemplate.excluidoEm),
          ),
          columns: colunasMensagemTemplate,
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

        await ctx.db.insert(mensagem).values(
          comCriadoEm({
            conversaId: conversation!.id,
            direcao: "outbound",
            tipo: "template",
            corpo: input.corpo ?? template.nome,
            templateNome: template.nome,
            templateIdioma: template.idioma,
            templateVariaveis: input.variaveis ?? null,
            idExterno: externalId,
            enviadoPorUsuarioId: ctx.usuario!.internalId,
          }),
        );
      } else if (input.corpo) {
        const externalId = await sendProviderMessage({
          ctx,
          instance,
          phone,
          type: "text",
          body: input.corpo,
        });
        await ctx.db.insert(mensagem).values(
          comCriadoEm({
            conversaId: conversation!.id,
            direcao: "outbound",
            tipo: "text",
            corpo: input.corpo,
            idExterno: externalId,
            enviadoPorUsuarioId: ctx.usuario!.internalId,
          }),
        );
      }

      return { conversaId: conversation!.uuid };
    },

    atribuir: async (ctx: WebContext, input: { conversaId: string; usuarioId: string | null }) => {
      exigirAutenticacao(ctx);
      const conv = await exigirAcessoConversa(ctx, input.conversaId);
      if (conv.role !== "admin" && conv.role !== "usuario") forbidden();

      let atribuidoUsuarioId: number | null = null;
      if (input.usuarioId) {
        atribuidoUsuarioId = await resolverIdInterno(ctx.db, "usuario", input.usuarioId);
        if (atribuidoUsuarioId === null) notFound();
      }

      await ctx.db
        .update(conversa)
        .set(comTimestampAtualizacao({ atribuidoUsuarioId }))
        .where(eq(conversa.id, conv.conversation.id));
      return { ok: true };
    },

    fechar: async (ctx: WebContext, input: { conversaId: string }) => {
      exigirAutenticacao(ctx);
      const conv = await exigirAcessoConversa(ctx, input.conversaId);
      await ctx.db
        .update(conversa)
        .set(comTimestampAtualizacao({ status: "closed", fechadoEm: new Date() }))
        .where(eq(conversa.id, conv.conversation.id));
      return { ok: true };
    },
  },

  mensagens: {
    lista: async (ctx: WebContext, input: { conversaId: string }) => {
      exigirAutenticacao(ctx);
      const conv = await exigirAcessoConversa(ctx, input.conversaId);

      const rows = await ctx.db.query.mensagem.findMany({
        where: and(eq(mensagem.conversaId, conv.conversation.id), isNull(mensagem.excluidoEm)),
        columns: colunasMensagemLista,
        with: { enviadoPorUsuario: incluirUsuarioRelacao },
        orderBy: [asc(mensagem.criadoEm)],
      });

      return rows.map((m) => mapearMensagemParaSaida(m, ctx.env.CDN_URL));
    },

    enviar: async (
      ctx: WebContext,
      input: {
        conversaId: string;
        tipo: string;
        body?: string;
        mediaUrl?: string;
        mediaR2Key?: string;
        filename?: string;
        voice?: boolean;
        latitude?: number;
        longitude?: number;
        localNome?: string;
        localEndereco?: string;
        contatos?: unknown[];
        interactive?: unknown;
        payload?: unknown;
        contextoMensagemId?: string;
        mensagemIdExterno?: string;
        emoji?: string;
      },
    ) => {
      exigirAutenticacao(ctx);
      const conv = await exigirAcessoConversa(ctx, input.conversaId);
      if (!conv.contact) notFound();

      verificarPodeEscreverCaixaEntrada(conv.role);
      if (!isInstanceOperational(conv.instance)) preconditionFailed("Instância não conectada");
      if (
        conv.role === "usuario" &&
        conv.conversation.atribuidoUsuarioId &&
        conv.conversation.atribuidoUsuarioId !== ctx.usuario!.internalId
      ) {
        forbidden("Conversa não atribuída a você");
      }

      const tipo = input.tipo;
      assertMessageTypeSupported(tipo, conv.instance.provedor);

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
        mediaR2Key: input.mediaR2Key,
        caption: input.body,
        filename: input.filename,
        voice: input.voice,
        latitude: input.latitude,
        longitude: input.longitude,
        localNome: input.localNome,
        localEndereco: input.localEndereco,
        contatos: input.contatos,
        interactive: input.interactive,
        payload: input.payload,
        contextoMensagemId: input.contextoMensagemId,
        mensagemIdExterno: input.mensagemIdExterno,
        emoji: input.emoji,
      });

      const corpo =
        input.body ??
        (tipo === "reaction" ? (input.emoji ?? null) : null) ??
        (["button", "list", "carousel", "poll", "link", "interactive"].includes(tipo)
          ? `[${tipo}]`
          : null);

      const [message] = await ctx.db
        .insert(mensagem)
        .values(
          comCriadoEm({
            conversaId: conv.conversation.id,
            direcao: "outbound",
            tipo,
            corpo,
            midiaR2Chave: input.mediaR2Key ?? null,
            idExterno: externalId,
            enviadoPorUsuarioId: ctx.usuario!.internalId,
          }),
        )
        .returning();

      await ctx.db
        .update(conversa)
        .set(comTimestampAtualizacao({ ultimaMensagemEm: new Date() }))
        .where(eq(conversa.id, conv.conversation.id));

      const usuario = ctx.usuario!;
      return mapearMensagemParaSaida(
        {
          ...message!,
          enviadoPorUsuario: { uuid: usuario.id, nome: usuario.nome },
        },
        ctx.env.CDN_URL,
      );
    },

    marcarLido: async (
      ctx: WebContext,
      input: { conversaId: string; mensagemIdExterno: string },
    ) => {
      exigirAutenticacao(ctx);
      const conv = await exigirAcessoConversa(ctx, input.conversaId);
      if (!conv.contact) notFound();

      await markProviderMessageRead(
        ctx,
        conv.instance,
        conv.contact.telefone,
        input.mensagemIdExterno,
      );
      return { ok: true };
    },

    enviarTemplate: async (
      ctx: WebContext,
      input: {
        conversaId: string;
        templateId: string;
        variaveis?: Record<string, string>;
      },
    ) => {
      exigirAutenticacao(ctx);
      const conv = await exigirAcessoConversa(ctx, input.conversaId);
      if (!conv.contact) notFound();
      verificarPodeEscreverCaixaEntrada(conv.role);

      const template = await ctx.db.query.mensagemTemplate.findFirst({
        where: and(
          eq(mensagemTemplate.uuid, input.templateId),
          isNull(mensagemTemplate.excluidoEm),
        ),
        columns: colunasMensagemTemplate,
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

      const [message] = await ctx.db
        .insert(mensagem)
        .values(
          comCriadoEm({
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
        )
        .returning();

      await ctx.db
        .update(conversa)
        .set(comTimestampAtualizacao({ ultimaMensagemEm: new Date() }))
        .where(eq(conversa.id, conv.conversation.id));

      const usuario = ctx.usuario!;
      return mapearMensagemParaSaida(
        {
          ...message!,
          enviadoPorUsuario: { uuid: usuario.id, nome: usuario.nome },
        },
        ctx.env.CDN_URL,
      );
    },
  },

  templates: {
    lista: async (ctx: WebContext, input: { instanciaId: string }) => {
      exigirAutenticacao(ctx);
      const { instance } = await exigirAcessoInstancia(ctx, input.instanciaId);

      const rows = await ctx.db.query.mensagemTemplate.findMany({
        where: and(
          eq(mensagemTemplate.instanciaId, instance.id),
          isNull(mensagemTemplate.excluidoEm),
        ),
        columns: {
          uuid: true,
          nome: true,
          idioma: true,
          categoria: true,
          status: true,
          componentes: true,
        },
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
      exigirAutenticacao(ctx);
      const { instance } = await exigirAcessoInstancia(ctx, input.instanciaId);
      if (instance.provedor !== "cloud_api") preconditionFailed("Somente Cloud API");

      const creds = obterCredenciaisMeta(instance);
      const meta = createMetaClient(creds);
      const { data } = await meta.listTemplates();

      await Promise.all(data.map((tpl) => sincronizarTemplateMeta(ctx, instance.id, tpl)));

      return { sincronizados: data.length };
    },
  },

  anotacoes: {
    lista: async (ctx: WebContext, input: { conversaId: string }) => {
      exigirAutenticacao(ctx);
      const conv = await exigirAcessoConversa(ctx, input.conversaId);

      const rows = await ctx.db.query.conversaAnotacao.findMany({
        where: and(
          eq(conversaAnotacao.conversaId, conv.conversation.id),
          isNull(conversaAnotacao.excluidoEm),
        ),
        columns: colunasConversaAnotacao,
        with: { autorUsuario: incluirUsuarioRelacao },
        orderBy: [asc(conversaAnotacao.criadoEm)],
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
      exigirAutenticacao(ctx);
      const conv = await exigirAcessoConversa(ctx, input.conversaId);
      verificarPodeEscreverCaixaEntrada(conv.role);

      const [note] = await ctx.db
        .insert(conversaAnotacao)
        .values(
          comTimestampsCriacao({
            conversaId: conv.conversation.id,
            autorUsuarioId: ctx.usuario!.internalId,
            corpo: input.body,
          }),
        )
        .returning();
      return { id: note!.uuid };
    },
  },
};
