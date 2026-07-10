import { index, integer, pgTable, serial, text, timestamp, unique } from "drizzle-orm/pg-core";

import { instancia } from "./instancias";

/** Credenciais Meta WhatsApp Cloud API por instância. */
export const instanciaMetaCloud = pgTable(
  "instancia_meta_cloud",
  {
    id: serial().primaryKey(),
    instanciaId: integer()
      .notNull()
      .references(() => instancia.id, { onDelete: "cascade" }),
    phoneNumberId: text().unique(),
    wabaId: text(),
    accessToken: text(),
    criadoEm: timestamp().notNull(),
    atualizadoEm: timestamp().notNull(),
  },
  (t) => [
    unique().on(t.instanciaId),
    index("instancia_meta_cloud_instancia_id_idx").on(t.instanciaId),
    index("instancia_meta_cloud_phone_number_id_idx").on(t.phoneNumberId),
  ],
);
