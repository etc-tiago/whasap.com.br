import {
  integer,
  jsonb,
  pgTable,
  serial,
  text,
  timestamp,
  unique,
  uuid as pgUuid,
} from "drizzle-orm/pg-core";

import { usuario } from "./autenticacao";
import { instances } from "./instancias";
import { organizations } from "./organizacoes";

export const contacts = pgTable(
  "contacts",
  {
    id: serial("id").primaryKey(),
    uuid: pgUuid("uuid").notNull().unique().defaultRandom(),
    instanceId: integer("instance_id")
      .notNull()
      .references(() => instances.id, { onDelete: "cascade" }),
    phone: text("phone").notNull(),
    name: text("name"),
    externalId: text("external_id"),
    excluidoEm: timestamp("excluido_em"),
    criadoEm: timestamp("criado_em").notNull(),
    atualizadoEm: timestamp("atualizado_em").notNull(),
  },
  (t) => [unique().on(t.instanceId, t.phone)],
);

export const contactTags = pgTable("contact_tags", {
  id: serial("id").primaryKey(),
  organizationId: integer("organization_id")
    .notNull()
    .references(() => organizations.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  color: text("color"),
  criadoEm: timestamp("criado_em").notNull(),
});

export const contactTagAssignments = pgTable(
  "contact_tag_assignments",
  {
    id: serial("id").primaryKey(),
    contactId: integer("contact_id")
      .notNull()
      .references(() => contacts.id, { onDelete: "cascade" }),
    tagId: integer("tag_id")
      .notNull()
      .references(() => contactTags.id, { onDelete: "cascade" }),
    criadoEm: timestamp("criado_em").notNull(),
  },
  (t) => [unique().on(t.contactId, t.tagId)],
);

export const conversations = pgTable("conversations", {
  id: serial("id").primaryKey(),
  uuid: pgUuid("uuid").notNull().unique().defaultRandom(),
  instanceId: integer("instance_id")
    .notNull()
    .references(() => instances.id, { onDelete: "cascade" }),
  contactId: integer("contact_id")
    .notNull()
    .references(() => contacts.id, { onDelete: "cascade" }),
  assignedUsuarioId: integer("assigned_usuario_id").references(() => usuario.id),
  status: text("status").notNull().default("open"),
  cloudWindowExpiresAt: timestamp("cloud_window_expires_at"),
  lastMessageAt: timestamp("last_message_at"),
  closedAt: timestamp("closed_at"),
  excluidoEm: timestamp("excluido_em"),
  criadoEm: timestamp("criado_em").notNull(),
  atualizadoEm: timestamp("atualizado_em").notNull(),
});

export const messages = pgTable("messages", {
  id: serial("id").primaryKey(),
  uuid: pgUuid("uuid").notNull().unique().defaultRandom(),
  conversationId: integer("conversation_id")
    .notNull()
    .references(() => conversations.id, { onDelete: "cascade" }),
  direction: text("direction").notNull(),
  type: text("type").notNull().default("text"),
  body: text("body"),
  mediaR2Key: text("media_r2_key"),
  templateName: text("template_name"),
  templateLanguage: text("template_language"),
  templateVariables: jsonb("template_variables"),
  metadata: jsonb("metadata"),
  externalId: text("external_id"),
  sentByUsuarioId: integer("sent_by_usuario_id").references(() => usuario.id),
  status: text("status").notNull().default("sent"),
  excluidoEm: timestamp("excluido_em"),
  criadoEm: timestamp("criado_em").notNull(),
});

export const messageTemplates = pgTable(
  "message_templates",
  {
    id: serial("id").primaryKey(),
    uuid: pgUuid("uuid").notNull().unique().defaultRandom(),
    instanceId: integer("instance_id")
      .notNull()
      .references(() => instances.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    language: text("language").notNull().default("pt_BR"),
    category: text("category"),
    status: text("status").notNull().default("approved"),
    components: jsonb("components"),
    externalId: text("external_id"),
    syncedAt: timestamp("synced_at"),
    excluidoEm: timestamp("excluido_em"),
    criadoEm: timestamp("criado_em").notNull(),
    atualizadoEm: timestamp("atualizado_em").notNull(),
  },
  (t) => [unique().on(t.instanceId, t.name, t.language)],
);

export const conversationNotes = pgTable("conversation_notes", {
  id: serial("id").primaryKey(),
  uuid: pgUuid("uuid").notNull().unique().defaultRandom(),
  conversationId: integer("conversation_id")
    .notNull()
    .references(() => conversations.id, { onDelete: "cascade" }),
  authorUsuarioId: integer("author_usuario_id")
    .notNull()
    .references(() => usuario.id),
  body: text("body").notNull(),
  excluidoEm: timestamp("excluido_em"),
  criadoEm: timestamp("criado_em").notNull(),
  atualizadoEm: timestamp("atualizado_em").notNull(),
});

export const quickReplies = pgTable("quick_replies", {
  id: serial("id").primaryKey(),
  organizationId: integer("organization_id")
    .notNull()
    .references(() => organizations.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  body: text("body").notNull(),
  criadoEm: timestamp("criado_em").notNull(),
});

export const monthlyUsage = pgTable(
  "monthly_usage",
  {
    id: serial("id").primaryKey(),
    instanceId: integer("instance_id")
      .notNull()
      .references(() => instances.id, { onDelete: "cascade" }),
    yearMonth: text("year_month").notNull(),
    uniqueContactsCount: integer("unique_contacts_count").notNull().default(0),
    atualizadoEm: timestamp("atualizado_em").notNull(),
  },
  (t) => [unique().on(t.instanceId, t.yearMonth)],
);

export const monthlyUsageContacts = pgTable(
  "monthly_usage_contacts",
  {
    id: serial("id").primaryKey(),
    instanceId: integer("instance_id")
      .notNull()
      .references(() => instances.id, { onDelete: "cascade" }),
    contactId: integer("contact_id")
      .notNull()
      .references(() => contacts.id, { onDelete: "cascade" }),
    yearMonth: text("year_month").notNull(),
    countedAt: timestamp("counted_at").notNull(),
  },
  (t) => [unique().on(t.instanceId, t.contactId, t.yearMonth)],
);
