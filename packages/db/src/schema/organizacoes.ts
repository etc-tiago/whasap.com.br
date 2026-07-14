import {
  boolean,
  index,
  integer,
  pgTable,
  serial,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";

import { papelMembroEnum, usuario } from "./autenticacao";

export const organizacao = pgTable("organizacao", {
  id: serial().primaryKey(),
  uuid: uuid().notNull().unique().defaultRandom(),
  nome: text().notNull(),
  slug: text().notNull().unique(),
  documentoFiscal: text(),
  tipoDocumento: text(),
  razaoSocial: text(),
  /** WhatsApp de contato da org (faturamento / suporte). */
  telefoneWhatsapp: text(),
  /** Aceite do termo de adesão na criação da org. */
  aceiteAdesaoEm: timestamp(),
  aceiteAdesaoVersao: text(),
  /** Cota mensal de conversas únicas da org (base + ajustes manuais). */
  limiteConversas: integer().notNull().default(1000),
  horasAutoFecharInatividade: text().default("72"),
  /**
   * Quando true, o nome do atendente vai como primeira linha do texto/legenda
   * enviado ao WhatsApp (`Nome\nconteúdo`). Áudio/sticker: texto só com o nome antes da mídia.
   */
  exibirNomeAtendenteMensagens: boolean().notNull().default(false),
  excluidoEm: timestamp(),
  criadoEm: timestamp().notNull(),
  atualizadoEm: timestamp().notNull(),
});

export const organizacaoMembro = pgTable(
  "organizacao_membro",
  {
    id: serial().primaryKey(),
    uuid: uuid().notNull().unique().defaultRandom(),
    organizacaoId: integer()
      .notNull()
      .references(() => organizacao.id, { onDelete: "cascade" }),
    usuarioId: integer()
      .notNull()
      .references(() => usuario.id, { onDelete: "cascade" }),
    papel: papelMembroEnum().notNull().default("usuario"),
    convidadoEm: timestamp(),
    ingressouEm: timestamp().notNull(),
    excluidoEm: timestamp(),
    criadoEm: timestamp().notNull(),
  },
  (t) => [
    unique().on(t.organizacaoId, t.usuarioId),
    index("organizacao_membro_usuario_id_idx").on(t.usuarioId),
  ],
);

export const organizacaoConvite = pgTable(
  "organizacao_convite",
  {
    id: serial().primaryKey(),
    uuid: uuid().notNull().unique().defaultRandom(),
    organizacaoId: integer()
      .notNull()
      .references(() => organizacao.id, { onDelete: "cascade" }),
    email: text().notNull(),
    nome: text(),
    papel: papelMembroEnum().notNull().default("usuario"),
    token: text().notNull().unique(),
    expiraEm: timestamp().notNull(),
    aceitoEm: timestamp(),
    criadoPorUsuarioId: integer().references(() => usuario.id),
    excluidoEm: timestamp(),
    criadoEm: timestamp().notNull(),
  },
  (t) => [index("organizacao_convite_organizacao_id_idx").on(t.organizacaoId)],
);
