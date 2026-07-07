import {
  boolean,
  index,
  integer,
  pgEnum,
  pgTable,
  serial,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";

import { organizacao } from "./organizacoes";

export const instanciaProvedorEnum = pgEnum("instancia_provedor", ["cloud_api", "evolution"]);
export const instanciaStatusEnum = pgEnum("instancia_status", [
  "pending_connection",
  "pending_payment",
  "provisioning",
  "disconnected",
  "connected",
  "deactivated",
]);

export const instancia = pgTable(
  "instancia",
  {
    id: serial().primaryKey(),
    uuid: uuid().notNull().unique().defaultRandom(),
    organizacaoId: integer()
      .notNull()
      .references(() => organizacao.id, { onDelete: "cascade" }),
    nome: text().notNull(),
    provedor: instanciaProvedorEnum().notNull(),
    status: instanciaStatusEnum().notNull().default("pending_connection"),
    asaasIdAssinatura: text().unique(),
    limiteConversas: integer().notNull().default(1000),
    evolucaoNomeInstancia: text().unique(),
    nuvemIdNumeroTelefone: text().unique(),
    nuvemIdWaba: text(),
    nuvemTokenAcesso: text(),
    tentativasProvisionamento: integer().notNull().default(0),
    conectadoEm: timestamp(),
    trialTerminaEm: timestamp(),
    desativadoEm: timestamp(),
    excluidoEm: timestamp(),
    criadoEm: timestamp().notNull(),
    atualizadoEm: timestamp().notNull(),
  },
  (t) => [index("instancia_organizacao_id_idx").on(t.organizacaoId)],
);

export const instanciaAddon = pgTable(
  "instancia_addon",
  {
    id: serial().primaryKey(),
    instanciaId: integer()
      .notNull()
      .references(() => instancia.id, { onDelete: "cascade" }),
    asaasIdAssinatura: text().notNull(),
    tamanhoPacoteConversas: integer().notNull().default(1000),
    ativo: boolean().notNull().default(true),
    criadoEm: timestamp().notNull(),
  },
  (t) => [
    index("instancia_addon_instancia_id_idx").on(t.instanciaId),
    unique().on(t.instanciaId, t.asaasIdAssinatura),
  ],
);
