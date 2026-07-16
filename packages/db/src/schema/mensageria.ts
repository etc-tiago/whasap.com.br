import { sql } from "drizzle-orm";
import {
  index,
  integer,
  jsonb,
  pgTable,
  serial,
  text,
  timestamp,
  unique,
  uniqueIndex,
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
    organizacaoId: integer()
      .notNull()
      .references(() => organizacao.id, { onDelete: "cascade" }),
    idExterno: text().notNull(),
    telefone: text(),
    nome: text(),
    excluidoEm: timestamp(),
    criadoEm: timestamp().notNull(),
    atualizadoEm: timestamp().notNull(),
  },
  (t) => [
    unique().on(t.organizacaoId, t.idExterno),
    index("contato_organizacao_id_idx").on(t.organizacaoId),
  ],
);

/** Vínculo do contato org com uma linha WhatsApp (instância) e id externo da sessão. */
export const contatoInstancia = pgTable(
  "contato_instancia",
  {
    id: serial().primaryKey(),
    contatoId: integer()
      .notNull()
      .references(() => contato.id, { onDelete: "cascade" }),
    instanciaId: integer()
      .notNull()
      .references(() => instancia.id, { onDelete: "cascade" }),
    idExterno: text().notNull(),
    criadoEm: timestamp().notNull(),
    atualizadoEm: timestamp().notNull(),
  },
  (t) => [
    unique().on(t.instanciaId, t.idExterno),
    unique().on(t.contatoId, t.instanciaId),
    index("contato_instancia_contato_id_idx").on(t.contatoId),
    index("contato_instancia_instancia_id_idx").on(t.instanciaId),
  ],
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
    idExterno: text(),
    criadoEm: timestamp().notNull(),
  },
  (t) => [
    index("contato_tag_organizacao_id_idx").on(t.organizacaoId),
    unique("contato_tag_org_id_externo_unique").on(t.organizacaoId, t.idExterno),
  ],
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
    metaCloudJanelaExpiraEm: timestamp(),
    ultimaMensagemEm: timestamp(),
    /** Preview denormalizado da última mensagem (lista da inbox sem N+1). */
    ultimaMensagemCorpo: text(),
    ultimaMensagemTipo: text(),
    naoLidas: integer().notNull().default(0),
    ultimaLeituraEm: timestamp(),
    fechadoEm: timestamp(),
    /** Arquivo local no painel (independente de status open/closed). */
    arquivadoEm: timestamp(),
    excluidoEm: timestamp(),
    criadoEm: timestamp().notNull(),
    atualizadoEm: timestamp().notNull(),
  },
  (t) => [
    index("conversa_instancia_ultima_mensagem_idx").on(t.instanciaId, t.ultimaMensagemEm),
    index("conversa_instancia_contato_status_idx").on(t.instanciaId, t.contatoId, t.status),
    index("conversa_instancia_arquivado_ultima_mensagem_idx").on(
      t.instanciaId,
      t.arquivadoEm,
      t.ultimaMensagemEm,
    ),
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
    /** Horário do evento no WhatsApp (`messageTimestamp`) — eixo da timeline. */
    enviadoEm: timestamp().notNull(),
    /** Quando o Whasap persistiu a linha (audit). */
    criadoEm: timestamp().notNull(),
  },
  (t) => [
    index("mensagem_conversa_enviado_em_idx").on(t.conversaId, t.enviadoEm),
    index("mensagem_conversa_direcao_enviado_em_idx").on(t.conversaId, t.direcao, t.enviadoEm),
    uniqueIndex("mensagem_id_externo_unique")
      .on(t.idExterno)
      .where(sql`${t.idExterno} IS NOT NULL AND ${t.excluidoEm} IS NULL`),
    index("mensagem_enviado_por_usuario_direcao_enviado_em_idx").on(
      t.enviadoPorUsuarioId,
      t.direcao,
      t.enviadoEm,
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
    uuid: uuid().notNull().unique().defaultRandom(),
    organizacaoId: integer()
      .notNull()
      .references(() => organizacao.id, { onDelete: "cascade" }),
    titulo: text().notNull(),
    excluidoEm: timestamp(),
    criadoEm: timestamp().notNull(),
    atualizadoEm: timestamp().notNull(),
  },
  (t) => [index("resposta_rapida_organizacao_id_idx").on(t.organizacaoId)],
);

/** Item de uma resposta rápida (texto, imagem ou documento); sequência ordenada. */
export const respostaRapidaItem = pgTable(
  "resposta_rapida_item",
  {
    id: serial().primaryKey(),
    uuid: uuid().notNull().unique().defaultRandom(),
    respostaRapidaId: integer()
      .notNull()
      .references(() => respostaRapida.id, { onDelete: "cascade" }),
    ordem: integer().notNull().default(0),
    /** text | image | document */
    tipo: text().notNull(),
    corpo: text(),
    midiaR2Chave: text(),
    nomeArquivo: text(),
    criadoEm: timestamp().notNull(),
  },
  (t) => [index("resposta_rapida_item_resposta_rapida_id_idx").on(t.respostaRapidaId)],
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
