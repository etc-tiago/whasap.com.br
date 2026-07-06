import { integer, pgTable, serial, text, timestamp, uuid as pgUuid } from "drizzle-orm/pg-core";

export const officeUsuario = pgTable("office_usuario", {
  id: serial("id").primaryKey(),
  uuid: pgUuid("uuid").notNull().unique().defaultRandom(),
  email: text("email").notNull().unique(),
  nome: text("nome").notNull(),
  excluidoEm: timestamp("excluido_em"),
  criadoEm: timestamp("criado_em").notNull(),
  atualizadoEm: timestamp("atualizado_em").notNull(),
});

export const sessaoOffice = pgTable("sessao_office", {
  id: serial("id").primaryKey(),
  officeUsuarioId: integer("office_usuario_id")
    .notNull()
    .references(() => officeUsuario.id, { onDelete: "cascade" }),
  token: text("token").notNull().unique(),
  expiraEm: timestamp("expira_em").notNull(),
  criadoEm: timestamp("criado_em").notNull(),
});
