import {
  assertOtpSendAllowed,
  atribuirSessaoRpc,
  beginAuthAttempt,
  criarOtp,
  failAuthAttemptWithCode,
  limparSessaoRpc,
  normalizarOtp,
  sendOtpEmail,
  unauthorized,
  verificarOtp,
} from "@whasap/api-core";
import {
  colunasUsuarioSessao,
  colunasUsuarioSomenteId,
  comTimestampsCriacao,
  usuario,
} from "@whasap/db";
import { and, eq, isNull } from "drizzle-orm";

import { createSession } from "../lib/session";
import type { WebContext } from "../types";
import { mapearSessaoParaSaida } from "./auth-session";

export {
  exigirAdmin,
  exigirAdminPorIdInterno,
  exigirAutenticacao,
  exigirOrganizacao,
  exigirOrganizacaoPorIdInterno,
  mapearSessaoParaSaida,
  resolverMembro,
  resolverMembroPorIdInterno,
} from "./auth-session";

const propositoInterno = {
  entrar: "login",
  cadastrar: "signup",
  convite: "invite",
} as const;

type EnviarOtpInput = {
  email: string;
  proposito: keyof typeof propositoInterno;
};

type EntrarInput = {
  email: string;
  otp: string;
};

type CadastrarInput = {
  email: string;
  nome: string;
  otp: string;
  lgpdConsent: true;
};

export const autenticacaoHandlers = {
  /**
   * Envia OTP por e-mail conforme propósito (`entrar`, `cadastrar`, `convite`).
   * Valida existência da conta antes de enviar.
   */
  enviarOtp: async (ctx: WebContext, input: EnviarOtpInput) => {
    const email = input.email.toLowerCase();
    await assertOtpSendAllowed(ctx, email);
    const finalidade = propositoInterno[input.proposito];

    if (input.proposito === "cadastrar") {
      const existente = await ctx.db.query.usuario.findFirst({
        where: and(eq(usuario.email, email), isNull(usuario.excluidoEm)),
        columns: colunasUsuarioSomenteId,
      });
      if (existente) {
        await failAuthAttemptWithCode(ctx.env, email, "CONFLICT", "Email já cadastrado.");
      }
    }

    if (input.proposito === "entrar") {
      const existente = await ctx.db.query.usuario.findFirst({
        where: and(eq(usuario.email, email), isNull(usuario.excluidoEm)),
        columns: colunasUsuarioSomenteId,
      });
      if (!existente) {
        await failAuthAttemptWithCode(ctx.env, email, "NOT_FOUND", "Conta não encontrada.");
      }
    }

    const code = await criarOtp(ctx, email, finalidade);
    await sendOtpEmail(ctx.env, email, code, finalidade);
    return { ok: true };
  },

  /**
   * Cria conta após validar OTP de cadastro e consentimento LGPD.
   * Inicia sessão web sem organização ativa.
   */
  cadastrar: async (ctx: WebContext, input: CadastrarInput) => {
    const email = input.email.toLowerCase();
    await beginAuthAttempt(ctx.env, email);

    const valid = await verificarOtp(ctx, email, "signup", normalizarOtp(input.otp));
    if (!valid) {
      unauthorized("Código inválido ou expirado.");
    }

    const now = new Date();

    const [user] = await ctx.db
      .insert(usuario)
      .values(
        comTimestampsCriacao({
          email,
          nome: input.nome,
          emailVerificadoEm: now,
          lgpdConsentidoEm: now,
        }),
      )
      .returning();

    const { token, expiraEm } = await createSession(ctx, user!.id);
    atribuirSessaoRpc(ctx, token, expiraEm);
    ctx.usuario = {
      id: user!.uuid,
      internalId: user!.id,
      email: user!.email,
      nome: user!.nome,
      emailVerificadoEm: user!.emailVerificadoEm,
    };
    ctx.organizationId = null;
    ctx.role = null;

    return {};
  },

  /** Valida OTP de login e cria sessão web. */
  entrar: async (ctx: WebContext, input: EntrarInput) => {
    const email = input.email.toLowerCase();
    await beginAuthAttempt(ctx.env, email);

    const valid = await verificarOtp(ctx, email, "login", normalizarOtp(input.otp));
    if (!valid) {
      unauthorized("Código inválido ou expirado.");
    }

    const loggedInUser = await ctx.db.query.usuario.findFirst({
      where: and(eq(usuario.email, email), isNull(usuario.excluidoEm)),
      columns: colunasUsuarioSessao,
    });

    if (!loggedInUser) {
      await failAuthAttemptWithCode(ctx.env, email, "NOT_FOUND", "Conta não encontrada.");
    }

    const { token, expiraEm } = await createSession(ctx, loggedInUser!.id);
    atribuirSessaoRpc(ctx, token, expiraEm);
    ctx.usuario = {
      id: loggedInUser!.uuid,
      internalId: loggedInUser!.id,
      email: loggedInUser!.email,
      nome: loggedInUser!.nome,
      emailVerificadoEm: loggedInUser!.emailVerificadoEm,
    };
    ctx.organizationId = null;
    ctx.role = null;

    return {};
  },

  /** Encerra sessão web e invalida cookie. */
  sair: async (ctx: WebContext) => {
    if (ctx.sessionToken) {
      const { deleteSession } = await import("../lib/session");
      await deleteSession(ctx, ctx.sessionToken);
    }
    limparSessaoRpc(ctx);
    return { ok: true };
  },

  /**
   * Retorna usuário, organização ativa e papel na sessão.
   * Reidrata `ctx.organizationId` e `ctx.role` a partir do banco.
   */
  eu: async (ctx: WebContext) => {
    const { getOrganizationForUser } = await import("../lib/session");
    const orgData = ctx.usuario
      ? await getOrganizationForUser(ctx, ctx.usuario.internalId, ctx.organizationId ?? undefined)
      : null;
    if (orgData) {
      ctx.organizationId = orgData.organization.id;
      ctx.role = orgData.role;
    }
    return mapearSessaoParaSaida(ctx, orgData?.organization ?? null);
  },
};
