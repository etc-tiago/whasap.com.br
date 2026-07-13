import { index, pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";

export const webhookEvento = pgTable(
  "webhook_evento",
  {
    id: serial().primaryKey(),
    origem: text().notNull(),
    idEvento: text(),
    payload: text().notNull(),
    processadoEm: timestamp(),
    criadoEm: timestamp().notNull(),
  },
  (t) => [
    index("webhook_evento_origem_criado_em_idx").on(t.origem, t.criadoEm),
    index("webhook_evento_id_evento_idx").on(t.idEvento),
  ],
);
