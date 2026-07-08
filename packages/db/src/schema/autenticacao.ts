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

export const papelMembroEnum = pgEnum("papel_membro", ["admin", "usuario", "analista"]);

export const tipoFluxoAutenticacaoEnum = pgEnum("tipo_fluxo_autenticacao", ["entrar", "cadastrar"]);

export const usuario = pgTable("usuario", {
  id: serial().primaryKey(),
  uuid: uuid().notNull().unique().defaultRandom(),
  email: text().notNull().unique(),
  nome: text().notNull(),
  emailVerificadoEm: timestamp(),
  lgpdConsentidoEm: timestamp(),
  excluidoEm: timestamp(),
  criadoEm: timestamp().notNull(),
  atualizadoEm: timestamp().notNull(),
});

export const sessao = pgTable(
  "sessao",
  {
    id: serial().primaryKey(),
    usuarioId: integer()
      .notNull()
      .references(() => usuario.id, { onDelete: "cascade" }),
    organizacaoId: integer(),
    token: text().notNull().unique(),
    expiraEm: timestamp().notNull(),
    criadoEm: timestamp().notNull(),
  },
  (t) => [index("sessao_usuario_id_idx").on(t.usuarioId)],
);

export const codigoOtp = pgTable(
  "codigo_otp",
  {
    id: serial().primaryKey(),
    email: text().notNull(),
    codigo: text().notNull(),
    finalidade: text().notNull(),
    expiraEm: timestamp().notNull(),
    usadoEm: timestamp(),
    criadoEm: timestamp().notNull(),
  },
  (t) => [
    index("codigo_otp_email_finalidade_criado_idx").on(t.email, t.finalidade, t.criadoEm),
    index("codigo_otp_email_finalidade_codigo_idx").on(t.email, t.finalidade, t.codigo),
  ],
);

export const fluxoAutenticacao = pgTable(
  "fluxo_autenticacao",
  {
    id: serial().primaryKey(),
    hash: uuid().notNull().unique(),
    email: text().notNull(),
    tipo: tipoFluxoAutenticacaoEnum().notNull(),
    pedidosOtp: integer().notNull().default(0),
    tentativasOtpInvalidas: integer().notNull().default(0),
    bloqueadoEm: timestamp(),
    linkMagico: uuid().unique(),
    linkMagicoExpiraEm: timestamp(),
    linkMagicoUsadoEm: timestamp(),
    expiraEm: timestamp().notNull(),
    criadoEm: timestamp().notNull(),
    atualizadoEm: timestamp().notNull(),
  },
  (t) => [index("fluxo_autenticacao_email_idx").on(t.email)],
);
