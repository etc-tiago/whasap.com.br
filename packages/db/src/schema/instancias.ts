import {
  index,
  integer,
  pgEnum,
  pgTable,
  serial,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

import { organizacao } from "./organizacoes";

export const instanciaProvedorEnum = pgEnum("instancia_provedor", ["evo", "meta_cloud"]);
/** `pending_payment` permanece no enum Postgres legado; o app não grava mais esse status. */
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
    /** Nome do ícone Lucide (allowlist `ICONES_CONEXAO` em `@whasap/config`). */
    icone: text().notNull().default("MessageCircle"),
    provedor: instanciaProvedorEnum().notNull(),
    status: instanciaStatusEnum().notNull().default("pending_connection"),
    /** Legado; cota de produto vive em `organizacao.limiteConversas`. */
    limiteConversas: integer().notNull().default(0),
    tentativasProvisionamento: integer().notNull().default(0),
    conectadoEm: timestamp(),
    desconectadoEm: timestamp(),
    /**
     * Sessão remota Evolution liberada pelo cleanup (não é soft-delete).
     * Painel continua listando a row para reconectar na mesma uuid.
     */
    sessaoRemotaLiberadaEm: timestamp(),
    desativadoEm: timestamp(),
    excluidoEm: timestamp(),
    criadoEm: timestamp().notNull(),
    atualizadoEm: timestamp().notNull(),
  },
  (t) => [
    index("instancia_organizacao_id_idx").on(t.organizacaoId),
    index("instancia_provedor_status_idx").on(t.provedor, t.status),
  ],
);
