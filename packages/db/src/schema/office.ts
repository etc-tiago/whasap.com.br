import {
  index,
  integer,
  pgTable,
  serial,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

export const officeUsuario = pgTable("office_usuario", {
  id: serial().primaryKey(),
  uuid: uuid().notNull().unique().defaultRandom(),
  email: text().notNull().unique(),
  nome: text().notNull(),
  excluidoEm: timestamp(),
  criadoEm: timestamp().notNull(),
  atualizadoEm: timestamp().notNull(),
});

export const officeSessao = pgTable(
  "office_sessao",
  {
    id: serial().primaryKey(),
    officeUsuarioId: integer()
      .notNull()
      .references(() => officeUsuario.id, { onDelete: "cascade" }),
    token: text().notNull().unique(),
    expiraEm: timestamp().notNull(),
    criadoEm: timestamp().notNull(),
  },
  (t) => [index("office_sessao_usuario_id_idx").on(t.officeUsuarioId)],
);
