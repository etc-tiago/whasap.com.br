import {
  integer,
  pgEnum,
  pgTable,
  serial,
  text,
  timestamp,
  uuid as pgUuid,
} from "drizzle-orm/pg-core";

export const papelMembroEnum = pgEnum("papel_membro", ["admin", "usuario", "analista"]);

export const usuario = pgTable("usuario", {
  id: serial("id").primaryKey(),
  uuid: pgUuid("uuid").notNull().unique().defaultRandom(),
  email: text("email").notNull().unique(),
  nome: text("nome").notNull(),
  emailVerificadoEm: timestamp("email_verificado_em"),
  lgpdConsentidoEm: timestamp("lgpd_consentido_em"),
  excluidoEm: timestamp("excluido_em"),
  criadoEm: timestamp("criado_em").notNull(),
  atualizadoEm: timestamp("atualizado_em").notNull(),
});

export const sessao = pgTable("sessao", {
  id: serial("id").primaryKey(),
  usuarioId: integer("usuario_id")
    .notNull()
    .references(() => usuario.id, { onDelete: "cascade" }),
  organizationId: integer("organization_id"),
  token: text("token").notNull().unique(),
  expiraEm: timestamp("expira_em").notNull(),
  criadoEm: timestamp("criado_em").notNull(),
});

export const codigoOtp = pgTable("codigo_otp", {
  id: serial("id").primaryKey(),
  email: text("email").notNull(),
  codigo: text("codigo").notNull(),
  finalidade: text("finalidade").notNull(),
  expiraEm: timestamp("expira_em").notNull(),
  usadoEm: timestamp("usado_em"),
  criadoEm: timestamp("criado_em").notNull(),
});
