import {
  index,
  integer,
  jsonb,
  pgTable,
  serial,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";

import { usuario } from "./autenticacao";
import { instancia } from "./instancias";
import { organizacao } from "./organizacoes";

export const contato = pgTable(
  "contato",
  {
    id: serial().primaryKey(),
    uuid: uuid().notNull().unique().defaultRandom(),
    instanciaId: integer()
      .notNull()
      .references(() => instancia.id, { onDelete: "cascade" }),
    telefone: text().notNull(),
    nome: text(),
    idExterno: text(),
    excluidoEm: timestamp(),
    criadoEm: timestamp().notNull(),
    atualizadoEm: timestamp().notNull(),
  },
  (t) => [unique().on(t.instanciaId, t.telefone)],
);

export const contatoTag = pgTable(
  "contato_tag",
  {
    id: serial().primaryKey(),
    uuid: uuid().notNull().unique().defaultRandom(),
    organizacaoId: integer()
      .notNull()
      .references(() => organizacao.id, { onDelete: "cascade" }),
    nome: text().notNull(),
    cor: text(),
    criadoEm: timestamp().notNull(),
  },
  (t) => [index("contato_tag_organizacao_id_idx").on(t.organizacaoId)],
);

export const contatoTagAtribuicao = pgTable(
  "contato_tag_atribuicao",
  {
    id: serial().primaryKey(),
    contatoId: integer()
      .notNull()
      .references(() => contato.id, { onDelete: "cascade" }),
    tagId: integer()
      .notNull()
      .references(() => contatoTag.id, { onDelete: "cascade" }),
    criadoEm: timestamp().notNull(),
  },
  (t) => [unique().on(t.contatoId, t.tagId)],
);

export const conversa = pgTable(
  "conversa",
  {
    id: serial().primaryKey(),
    uuid: uuid().notNull().unique().defaultRandom(),
    instanciaId: integer()
      .notNull()
      .references(() => instancia.id, { onDelete: "cascade" }),
    contatoId: integer()
      .notNull()
      .references(() => contato.id, { onDelete: "cascade" }),
    atribuidoUsuarioId: integer().references(() => usuario.id),
    status: text().notNull().default("open"),
    nuvemJanelaExpiraEm: timestamp(),
    ultimaMensagemEm: timestamp(),
    fechadoEm: timestamp(),
    excluidoEm: timestamp(),
    criadoEm: timestamp().notNull(),
    atualizadoEm: timestamp().notNull(),
  },
  (t) => [
    index("conversa_instancia_ultima_mensagem_idx").on(t.instanciaId, t.ultimaMensagemEm),
    index("conversa_instancia_contato_status_idx").on(t.instanciaId, t.contatoId, t.status),
    index("conversa_instancia_criado_em_idx").on(t.instanciaId, t.criadoEm),
    index("conversa_atribuido_usuario_id_idx").on(t.atribuidoUsuarioId),
  ],
);

export const mensagem = pgTable(
  "mensagem",
  {
    id: serial().primaryKey(),
    uuid: uuid().notNull().unique().defaultRandom(),
    conversaId: integer()
      .notNull()
      .references(() => conversa.id, { onDelete: "cascade" }),
    direcao: text().notNull(),
    tipo: text().notNull().default("text"),
    corpo: text(),
    midiaR2Chave: text(),
    templateNome: text(),
    templateIdioma: text(),
    templateVariaveis: jsonb(),
    metadados: jsonb(),
    idExterno: text(),
    enviadoPorUsuarioId: integer().references(() => usuario.id),
    status: text().notNull().default("sent"),
    excluidoEm: timestamp(),
    criadoEm: timestamp().notNull(),
  },
  (t) => [
    index("mensagem_conversa_criado_em_idx").on(t.conversaId, t.criadoEm),
    index("mensagem_conversa_direcao_criado_em_idx").on(t.conversaId, t.direcao, t.criadoEm),
    index("mensagem_id_externo_idx").on(t.idExterno),
    index("mensagem_enviado_por_usuario_direcao_criado_em_idx").on(
      t.enviadoPorUsuarioId,
      t.direcao,
      t.criadoEm,
    ),
  ],
);

export const mensagemTemplate = pgTable(
  "mensagem_template",
  {
    id: serial().primaryKey(),
    uuid: uuid().notNull().unique().defaultRandom(),
    instanciaId: integer()
      .notNull()
      .references(() => instancia.id, { onDelete: "cascade" }),
    nome: text().notNull(),
    idioma: text().notNull().default("pt_BR"),
    categoria: text(),
    status: text().notNull().default("approved"),
    componentes: jsonb(),
    idExterno: text(),
    sincronizadoEm: timestamp(),
    excluidoEm: timestamp(),
    criadoEm: timestamp().notNull(),
    atualizadoEm: timestamp().notNull(),
  },
  (t) => [
    unique().on(t.instanciaId, t.nome, t.idioma),
    index("mensagem_template_instancia_id_idx").on(t.instanciaId),
  ],
);

export const conversaAnotacao = pgTable(
  "conversa_anotacao",
  {
    id: serial().primaryKey(),
    uuid: uuid().notNull().unique().defaultRandom(),
    conversaId: integer()
      .notNull()
      .references(() => conversa.id, { onDelete: "cascade" }),
    autorUsuarioId: integer()
      .notNull()
      .references(() => usuario.id),
    corpo: text().notNull(),
    excluidoEm: timestamp(),
    criadoEm: timestamp().notNull(),
    atualizadoEm: timestamp().notNull(),
  },
  (t) => [index("conversa_anotacao_conversa_id_idx").on(t.conversaId)],
);

export const respostaRapida = pgTable(
  "resposta_rapida",
  {
    id: serial().primaryKey(),
    organizacaoId: integer()
      .notNull()
      .references(() => organizacao.id, { onDelete: "cascade" }),
    titulo: text().notNull(),
    corpo: text().notNull(),
    criadoEm: timestamp().notNull(),
  },
  (t) => [index("resposta_rapida_organizacao_id_idx").on(t.organizacaoId)],
);

export const usoMensal = pgTable(
  "uso_mensal",
  {
    id: serial().primaryKey(),
    instanciaId: integer()
      .notNull()
      .references(() => instancia.id, { onDelete: "cascade" }),
    anoMes: text().notNull(),
    contatosUnicosContagem: integer().notNull().default(0),
    atualizadoEm: timestamp().notNull(),
  },
  (t) => [unique().on(t.instanciaId, t.anoMes)],
);

export const usoMensalContato = pgTable(
  "uso_mensal_contato",
  {
    id: serial().primaryKey(),
    instanciaId: integer()
      .notNull()
      .references(() => instancia.id, { onDelete: "cascade" }),
    contatoId: integer()
      .notNull()
      .references(() => contato.id, { onDelete: "cascade" }),
    anoMes: text().notNull(),
    contadoEm: timestamp().notNull(),
  },
  (t) => [unique().on(t.instanciaId, t.contatoId, t.anoMes)],
);
