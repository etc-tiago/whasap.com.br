import { relations } from "drizzle-orm";

import { sessao, usuario } from "./autenticacao";
import { instancia, instanciaAddon } from "./instancias";
import {
  contato,
  contatoTag,
  contatoTagAtribuicao,
  conversa,
  conversaAnotacao,
  mensagem,
  mensagemTemplate,
} from "./mensageria";
import { officeSessao, officeUsuario } from "./office";
import { organizacao, organizacaoConvite, organizacaoMembro } from "./organizacoes";

export const usuarioRelations = relations(usuario, ({ many }) => ({
  sessoes: many(sessao),
  organizacaoMembros: many(organizacaoMembro),
  conversasAtribuidas: many(conversa),
  mensagensEnviadas: many(mensagem),
  conversaAnotacoes: many(conversaAnotacao),
}));

export const sessaoRelations = relations(sessao, ({ one }) => ({
  usuario: one(usuario, {
    fields: [sessao.usuarioId],
    references: [usuario.id],
  }),
  organizacao: one(organizacao, {
    fields: [sessao.organizacaoId],
    references: [organizacao.id],
  }),
}));

export const officeUsuarioRelations = relations(officeUsuario, ({ many }) => ({
  sessoes: many(officeSessao),
}));

export const officeSessaoRelations = relations(officeSessao, ({ one }) => ({
  officeUsuario: one(officeUsuario, {
    fields: [officeSessao.officeUsuarioId],
    references: [officeUsuario.id],
  }),
}));

export const organizacaoRelations = relations(organizacao, ({ many }) => ({
  membros: many(organizacaoMembro),
  convites: many(organizacaoConvite),
  instancias: many(instancia),
}));

export const organizacaoMembroRelations = relations(organizacaoMembro, ({ one }) => ({
  organizacao: one(organizacao, {
    fields: [organizacaoMembro.organizacaoId],
    references: [organizacao.id],
  }),
  usuario: one(usuario, {
    fields: [organizacaoMembro.usuarioId],
    references: [usuario.id],
  }),
}));

export const organizacaoConviteRelations = relations(organizacaoConvite, ({ one }) => ({
  organizacao: one(organizacao, {
    fields: [organizacaoConvite.organizacaoId],
    references: [organizacao.id],
  }),
  criadoPorUsuario: one(usuario, {
    fields: [organizacaoConvite.criadoPorUsuarioId],
    references: [usuario.id],
  }),
}));

export const instanciaRelations = relations(instancia, ({ one, many }) => ({
  organizacao: one(organizacao, {
    fields: [instancia.organizacaoId],
    references: [organizacao.id],
  }),
  conversas: many(conversa),
  contatos: many(contato),
  addons: many(instanciaAddon),
  mensagemTemplates: many(mensagemTemplate),
}));

export const mensagemTemplateRelations = relations(mensagemTemplate, ({ one }) => ({
  instancia: one(instancia, {
    fields: [mensagemTemplate.instanciaId],
    references: [instancia.id],
  }),
}));

export const instanciaAddonRelations = relations(instanciaAddon, ({ one }) => ({
  instancia: one(instancia, {
    fields: [instanciaAddon.instanciaId],
    references: [instancia.id],
  }),
}));

export const contatoRelations = relations(contato, ({ one, many }) => ({
  instancia: one(instancia, {
    fields: [contato.instanciaId],
    references: [instancia.id],
  }),
  conversas: many(conversa),
  tagAtribuicoes: many(contatoTagAtribuicao),
}));

export const contatoTagRelations = relations(contatoTag, ({ one, many }) => ({
  organizacao: one(organizacao, {
    fields: [contatoTag.organizacaoId],
    references: [organizacao.id],
  }),
  atribuicoes: many(contatoTagAtribuicao),
}));

export const contatoTagAtribuicaoRelations = relations(contatoTagAtribuicao, ({ one }) => ({
  contato: one(contato, {
    fields: [contatoTagAtribuicao.contatoId],
    references: [contato.id],
  }),
  tag: one(contatoTag, {
    fields: [contatoTagAtribuicao.tagId],
    references: [contatoTag.id],
  }),
}));

export const conversaRelations = relations(conversa, ({ one, many }) => ({
  instancia: one(instancia, {
    fields: [conversa.instanciaId],
    references: [instancia.id],
  }),
  contato: one(contato, {
    fields: [conversa.contatoId],
    references: [contato.id],
  }),
  atribuidoUsuario: one(usuario, {
    fields: [conversa.atribuidoUsuarioId],
    references: [usuario.id],
  }),
  mensagens: many(mensagem),
  anotacoes: many(conversaAnotacao),
}));

export const mensagemRelations = relations(mensagem, ({ one }) => ({
  conversa: one(conversa, {
    fields: [mensagem.conversaId],
    references: [conversa.id],
  }),
  enviadoPorUsuario: one(usuario, {
    fields: [mensagem.enviadoPorUsuarioId],
    references: [usuario.id],
  }),
}));

export const conversaAnotacaoRelations = relations(conversaAnotacao, ({ one }) => ({
  conversa: one(conversa, {
    fields: [conversaAnotacao.conversaId],
    references: [conversa.id],
  }),
  autorUsuario: one(usuario, {
    fields: [conversaAnotacao.autorUsuarioId],
    references: [usuario.id],
  }),
}));
