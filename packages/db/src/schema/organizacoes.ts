import {
  integer,
  pgTable,
  serial,
  text,
  timestamp,
  unique,
  uuid as pgUuid,
} from "drizzle-orm/pg-core";

import { papelMembroEnum, usuario } from "./autenticacao";

export const organizations = pgTable("organizations", {
  id: serial("id").primaryKey(),
  uuid: pgUuid("uuid").notNull().unique().defaultRandom(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  taxId: text("tax_id"),
  taxIdType: text("tax_id_type"),
  legalName: text("legal_name"),
  asaasCustomerId: text("asaas_customer_id"),
  autoCloseInactivityHours: text("auto_close_inactivity_hours").default("72"),
  excluidoEm: timestamp("excluido_em"),
  criadoEm: timestamp("criado_em").notNull(),
  atualizadoEm: timestamp("atualizado_em").notNull(),
});

export const organizationMembers = pgTable(
  "organization_members",
  {
    id: serial("id").primaryKey(),
    uuid: pgUuid("uuid").notNull().unique().defaultRandom(),
    organizationId: integer("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    usuarioId: integer("usuario_id")
      .notNull()
      .references(() => usuario.id, { onDelete: "cascade" }),
    role: papelMembroEnum("role").notNull().default("usuario"),
    invitedAt: timestamp("invited_at"),
    joinedAt: timestamp("joined_at").notNull(),
    excluidoEm: timestamp("excluido_em"),
    criadoEm: timestamp("criado_em").notNull(),
  },
  (t) => [unique().on(t.organizationId, t.usuarioId)],
);

export const organizationInvites = pgTable("organization_invites", {
  id: serial("id").primaryKey(),
  uuid: pgUuid("uuid").notNull().unique().defaultRandom(),
  organizationId: integer("organization_id")
    .notNull()
    .references(() => organizations.id, { onDelete: "cascade" }),
  email: text("email").notNull(),
  name: text("name"),
  role: papelMembroEnum("role").notNull().default("usuario"),
  token: text("token").notNull().unique(),
  expiresAt: timestamp("expires_at").notNull(),
  acceptedAt: timestamp("accepted_at"),
  createdByUsuarioId: integer("created_by_usuario_id").references(() => usuario.id),
  excluidoEm: timestamp("excluido_em"),
  criadoEm: timestamp("criado_em").notNull(),
});
