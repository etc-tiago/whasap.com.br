import { and, eq, isNull } from "drizzle-orm";
import {
  beginAuthAttempt,
  criarOtp,
  failAuthAttemptWithCode,
  sendOtpEmail,
  verificarOtp,
} from "@whasap/api-core";
import { colunasOfficeUsuarioSessao, colunasUsuarioSomenteId, officeUsuario } from "@whasap/db";

import { createSession } from "../lib/session";
import type { OfficeContext } from "../types";
import { exigirAutenticacaoOffice, mapearSessaoOfficeParaSaida } from "./auth-session";

type EnviarOtpInput = {
  email: string;
};

type EntrarInput = {
  email: string;
  otp: string;
};

export const autenticacaoHandlers = {
  /**
   * Envia OTP por e-mail para login no painel office.
   * Só usuários pré-cadastrados em `officeUsuario` recebem código.
   */
  enviarOtp: async (ctx: OfficeContext, input: EnviarOtpInput) => {
    const email = input.email.toLowerCase();
    await beginAuthAttempt(ctx.env, email);

    const existing = await ctx.db.query.officeUsuario.findFirst({
      where: and(eq(officeUsuario.email, email), isNull(officeUsuario.excluidoEm)),
      columns: colunasUsuarioSomenteId,
    });

    if (!existing) {
      await failAuthAttemptWithCode(ctx.env, email, "NOT_FOUND", "Acesso não autorizado.");
    }

    const code = await criarOtp(ctx, email, "office_login");
    await sendOtpEmail(ctx.env, email, code, "office_login");
    return { ok: true };
  },

  /**
   * Valida OTP e cria sessão office (cookie).
   */
  entrar: async (ctx: OfficeContext, input: EntrarInput) => {
    const email = input.email.toLowerCase();
    await beginAuthAttempt(ctx.env, email);

    const valid = await verificarOtp(ctx, email, "office_login", input.otp);
    if (!valid) {
      await failAuthAttemptWithCode(ctx.env, email, "UNAUTHORIZED", "Código inválido ou expirado.");
    }

    const loggedInUser = await ctx.db.query.officeUsuario.findFirst({
      where: and(eq(officeUsuario.email, email), isNull(officeUsuario.excluidoEm)),
      columns: colunasOfficeUsuarioSessao,
    });

    if (!loggedInUser) {
      await failAuthAttemptWithCode(ctx.env, email, "NOT_FOUND", "Acesso não autorizado.");
    }

    const token = await createSession(ctx, loggedInUser!.id);
    ctx.sessionToken = token;
    ctx.officeUsuario = {
      id: loggedInUser!.uuid,
      internalId: loggedInUser!.id,
      email: loggedInUser!.email,
      nome: loggedInUser!.nome,
    };

    return mapearSessaoOfficeParaSaida(ctx);
  },

  /** Encerra sessão office e invalida cookie. */
  sair: async (ctx: OfficeContext) => {
    if (ctx.sessionToken) {
      const { deleteSession } = await import("../lib/session");
      await deleteSession(ctx, ctx.sessionToken);
    }
    return { ok: true };
  },

  /** Retorna usuário da sessão office atual. */
  eu: async (ctx: OfficeContext) => {
    exigirAutenticacaoOffice(ctx);
    return mapearSessaoOfficeParaSaida(ctx);
  },
};

export { exigirAutenticacaoOffice, mapearSessaoOfficeParaSaida } from "./auth-session";
