import { relations } from "drizzle-orm";

import { sessao, usuario } from "./autenticacao";
import { instanceAddons, instances } from "./instancias";
import {
  contacts,
  conversationNotes,
  conversations,
  messageTemplates,
  messages,
} from "./mensageria";
import { officeUsuario, sessaoOffice } from "./office";
import {
  organizationInvites,
  organizationMembers,
  organizations,
} from "./organizacoes";

export const usuarioRelations = relations(usuario, ({ many }) => ({
  sessoes: many(sessao),
  organizationMembers: many(organizationMembers),
  assignedConversations: many(conversations),
  sentMessages: many(messages),
  conversationNotes: many(conversationNotes),
}));

export const sessaoRelations = relations(sessao, ({ one }) => ({
  usuario: one(usuario, {
    fields: [sessao.usuarioId],
    references: [usuario.id],
  }),
  organization: one(organizations, {
    fields: [sessao.organizationId],
    references: [organizations.id],
  }),
}));

export const officeUsuarioRelations = relations(officeUsuario, ({ many }) => ({
  sessoes: many(sessaoOffice),
}));

export const sessaoOfficeRelations = relations(sessaoOffice, ({ one }) => ({
  officeUsuario: one(officeUsuario, {
    fields: [sessaoOffice.officeUsuarioId],
    references: [officeUsuario.id],
  }),
}));

export const organizationsRelations = relations(organizations, ({ many }) => ({
  members: many(organizationMembers),
  invites: many(organizationInvites),
  instances: many(instances),
}));

export const organizationMembersRelations = relations(organizationMembers, ({ one }) => ({
  organization: one(organizations, {
    fields: [organizationMembers.organizationId],
    references: [organizations.id],
  }),
  usuario: one(usuario, {
    fields: [organizationMembers.usuarioId],
    references: [usuario.id],
  }),
}));

export const organizationInvitesRelations = relations(organizationInvites, ({ one }) => ({
  organization: one(organizations, {
    fields: [organizationInvites.organizationId],
    references: [organizations.id],
  }),
  createdByUsuario: one(usuario, {
    fields: [organizationInvites.createdByUsuarioId],
    references: [usuario.id],
  }),
}));

export const instancesRelations = relations(instances, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [instances.organizationId],
    references: [organizations.id],
  }),
  conversations: many(conversations),
  contacts: many(contacts),
  addons: many(instanceAddons),
  messageTemplates: many(messageTemplates),
}));

export const messageTemplatesRelations = relations(messageTemplates, ({ one }) => ({
  instance: one(instances, {
    fields: [messageTemplates.instanceId],
    references: [instances.id],
  }),
}));

export const instanceAddonsRelations = relations(instanceAddons, ({ one }) => ({
  instance: one(instances, {
    fields: [instanceAddons.instanceId],
    references: [instances.id],
  }),
}));

export const contactsRelations = relations(contacts, ({ one, many }) => ({
  instance: one(instances, {
    fields: [contacts.instanceId],
    references: [instances.id],
  }),
  conversations: many(conversations),
}));

export const conversationsRelations = relations(conversations, ({ one, many }) => ({
  instance: one(instances, {
    fields: [conversations.instanceId],
    references: [instances.id],
  }),
  contact: one(contacts, {
    fields: [conversations.contactId],
    references: [contacts.id],
  }),
  assignedUsuario: one(usuario, {
    fields: [conversations.assignedUsuarioId],
    references: [usuario.id],
  }),
  messages: many(messages),
  notes: many(conversationNotes),
}));

export const messagesRelations = relations(messages, ({ one }) => ({
  conversation: one(conversations, {
    fields: [messages.conversationId],
    references: [conversations.id],
  }),
  sentByUsuario: one(usuario, {
    fields: [messages.sentByUsuarioId],
    references: [usuario.id],
  }),
}));

export const conversationNotesRelations = relations(conversationNotes, ({ one }) => ({
  conversation: one(conversations, {
    fields: [conversationNotes.conversationId],
    references: [conversations.id],
  }),
  authorUsuario: one(usuario, {
    fields: [conversationNotes.authorUsuarioId],
    references: [usuario.id],
  }),
}));
