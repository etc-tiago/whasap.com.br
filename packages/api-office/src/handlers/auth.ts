import {
  beginAuthAttempt,
  createOtp,
  failAuthAttemptWithCode,
  sendOtpEmail,
  verifyOtp,
  verifyTurnstile,
} from "@whasap/api-core";

import { createSession } from "../lib/session";
import type { OfficeContext } from "../types";
import { requireOfficeAuth, toOfficeSessionOutput } from "./auth-session";

type EnviarOtpInput = {
  email: string;
  turnstileToken: string;
};

type EntrarInput = {
  email: string;
  otp: string;
  turnstileToken: string;
};

export const autenticacaoHandlers = {
  enviarOtp: async (ctx: OfficeContext, input: EnviarOtpInput) => {
    await verifyTurnstile(ctx.env, input.turnstileToken, ctx.clientIp);
    const email = input.email.toLowerCase();
    await beginAuthAttempt(ctx.env, email);

    const existing = await ctx.client.officeUsuario.findFirst({ where: { email } });

    if (!existing) {
      await failAuthAttemptWithCode(
        ctx.env,
        email,
        "NOT_FOUND",
        "Acesso não autorizado.",
      );
    }

    const code = await createOtp(ctx, email, "office_login");
    await sendOtpEmail(ctx.env, email, code, "office_login");
    return { ok: true };
  },

  entrar: async (ctx: OfficeContext, input: EntrarInput) => {
    await verifyTurnstile(ctx.env, input.turnstileToken, ctx.clientIp);
    const email = input.email.toLowerCase();
    await beginAuthAttempt(ctx.env, email);

    const valid = await verifyOtp(ctx, email, "office_login", input.otp);
    if (!valid) {
      await failAuthAttemptWithCode(
        ctx.env,
        email,
        "UNAUTHORIZED",
        "Código inválido ou expirado.",
      );
    }

    const user = await ctx.client.officeUsuario.findFirst({ where: { email } });

    if (!user) {
      await failAuthAttemptWithCode(
        ctx.env,
        email,
        "NOT_FOUND",
        "Acesso não autorizado.",
      );
    }

    const loggedInUser = user!;
    const token = await createSession(ctx, loggedInUser.id);
    ctx.sessionToken = token;
    ctx.officeUsuario = {
      id: loggedInUser.uuid,
      internalId: loggedInUser.id,
      email: loggedInUser.email,
      nome: loggedInUser.nome,
    };

    return toOfficeSessionOutput(ctx);
  },

  sair: async (ctx: OfficeContext) => {
    if (ctx.sessionToken) {
      const { deleteSession } = await import("../lib/session");
      await deleteSession(ctx, ctx.sessionToken);
    }
    return { ok: true };
  },

  eu: async (ctx: OfficeContext) => {
    requireOfficeAuth(ctx);
    return toOfficeSessionOutput(ctx);
  },
};

export { requireOfficeAuth, toOfficeSessionOutput } from "./auth-session";