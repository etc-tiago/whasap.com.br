import { index, integer, jsonb, pgTable, serial, text, timestamp, uuid } from "drizzle-orm/pg-core";

import { usuario } from "./autenticacao";
import { instancia } from "./instancias";
import { organizacao } from "./organizacoes";

/** Registro de cada disparo imediato do módulo de campanha. */
export const campanhaEnvio = pgTable(
  "campanha_envio",
  {
    id: serial().primaryKey(),
    uuid: uuid().notNull().unique().defaultRandom(),
    organizacaoId: integer()
      .notNull()
      .references(() => organizacao.id, { onDelete: "cascade" }),
    instanciaId: integer()
      .notNull()
      .references(() => instancia.id, { onDelete: "cascade" }),
    usuarioId: integer()
      .notNull()
      .references(() => usuario.id, { onDelete: "cascade" }),
    nomeDestinatario: text(),
    telefone: text().notNull(),
    /** Texto livre (WhatsApp Comercial) ou preview do template. */
    corpo: text(),
    templateNome: text(),
    templateIdioma: text(),
    templateVariaveis: jsonb(),
    /** enviado | erro */
    status: text().notNull(),
    erroMensagem: text(),
    conversaUuid: uuid(),
    excluidoEm: timestamp(),
    criadoEm: timestamp().notNull(),
  },
  (t) => [
    index("campanha_envio_organizacao_criado_em_idx").on(t.organizacaoId, t.criadoEm),
    index("campanha_envio_telefone_idx").on(t.telefone),
    index("campanha_envio_instancia_id_idx").on(t.instanciaId),
    index("campanha_envio_usuario_id_idx").on(t.usuarioId),
  ],
);

/** Template Cloud API memorizado para reutilização no módulo de campanha. */
export const campanhaTemplateMemorizado = pgTable(
  "campanha_template_memorizado",
  {
    id: serial().primaryKey(),
    uuid: uuid().notNull().unique().defaultRandom(),
    organizacaoId: integer()
      .notNull()
      .references(() => organizacao.id, { onDelete: "cascade" }),
    instanciaId: integer().references(() => instancia.id, { onDelete: "set null" }),
    /** Rótulo amigável escolhido pelo usuário. */
    nome: text().notNull(),
    templateNome: text().notNull(),
    templateIdioma: text().notNull(),
    /** Mapa de variáveis do body (`{"1":"valor",...}`). */
    variaveis: jsonb(),
    excluidoEm: timestamp(),
    criadoEm: timestamp().notNull(),
    atualizadoEm: timestamp().notNull(),
  },
  (t) => [
    index("campanha_template_memorizado_organizacao_id_idx").on(t.organizacaoId),
    index("campanha_template_memorizado_instancia_id_idx").on(t.instanciaId),
  ],
);
