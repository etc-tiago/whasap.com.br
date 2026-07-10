import { index, integer, pgTable, serial, text, timestamp, unique } from "drizzle-orm/pg-core";

import { instancia } from "./instancias";

/** Credenciais e estado Evolution GO (whatsmeow) por instância. */
export const instanciaEvo = pgTable(
  "instancia_evo",
  {
    id: serial().primaryKey(),
    instanciaId: integer()
      .notNull()
      .references(() => instancia.id, { onDelete: "cascade" }),
    nomeInstancia: text().unique(),
    instanceId: text().unique(),
    token: text(),
    historicoSincronizadoEm: timestamp(),
    historicoSincronizandoEm: timestamp(),
    criadoEm: timestamp().notNull(),
    atualizadoEm: timestamp().notNull(),
  },
  (t) => [
    unique().on(t.instanciaId),
    index("instancia_evo_instancia_id_idx").on(t.instanciaId),
    index("instancia_evo_nome_instancia_idx").on(t.nomeInstancia),
  ],
);
