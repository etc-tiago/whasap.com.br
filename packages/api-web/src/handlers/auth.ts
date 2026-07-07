import {
  beginAuthAttempt,
  createOtp,
  failAuthAttemptWithCode,
  sendOtpEmail,
  verifyOtp,
} from "@whasap/api-core";
import { appCreateData } from "@whasap/db";

import { createSession } from "../lib/session";
import type { WebContext } from "../types";
import { toSessionOutput } from "./auth-session";

export {
  requireAdmin,
  requireAdminInternal,
  requireAuth,
  requireOrg,
  requireOrgInternal,
  resolveMembership,
  resolveMembershipInternal,
  toSessionOutput,
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
  enviarOtp: async (ctx: WebContext, input: EnviarOtpInput) => {
    const email = input.email.toLowerCase();
    await beginAuthAttempt(ctx.env, email);
    const finalidade = propositoInterno[input.proposito];

    if (input.proposito === "cadastrar") {
      const existing = await ctx.client.usuario.findFirst({ where: { email } });
      if (existing) {
        await failAuthAttemptWithCode(
          ctx.env,
          email,
          "CONFLICT",
          "Email já cadastrado.",
        );
      }
    }

    if (input.proposito === "entrar") {
      const existing = await ctx.client.usuario.findFirst({ where: { email } });
      if (!existing) {
        await failAuthAttemptWithCode(
          ctx.env,
          email,
          "NOT_FOUND",
          "Conta não encontrada.",
        );
      }
    }

    const code = await createOtp(ctx, email, finalidade);
    await sendOtpEmail(ctx.env, email, code, finalidade);
    return { ok: true };
  },

  cadastrar: async (ctx: WebContext, input: CadastrarInput) => {
    const email = input.email.toLowerCase();
    await beginAuthAttempt(ctx.env, email);

    const valid = await verifyOtp(ctx, email, "signup", input.otp);
    if (!valid) {
      await failAuthAttemptWithCode(
        ctx.env,
        email,
        "UNAUTHORIZED",
        "Código inválido ou expirado.",
      );
    }

    const now = new Date();

    const user = await ctx.client.usuario.create({
      data: appCreateData({
        email,
        nome: input.nome,
        emailVerificadoEm: now,
        lgpdConsentidoEm: now,
      }),
    });

    const token = await createSession(ctx, user.id);
    ctx.sessionToken = token;
    ctx.usuario = {
      id: user.uuid,
      internalId: user.id,
      email: user.email,
      nome: user.nome,
      emailVerificadoEm: user.emailVerificadoEm,
    };
    ctx.organizationId = null;
    ctx.role = null;

    return toSessionOutput(ctx, null);
  },

  entrar: async (ctx: WebContext, input: EntrarInput) => {
    const email = input.email.toLowerCase();
    await beginAuthAttempt(ctx.env, email);

    const valid = await verifyOtp(ctx, email, "login", input.otp);
    if (!valid) {
      await failAuthAttemptWithCode(
        ctx.env,
        email,
        "UNAUTHORIZED",
        "Código inválido ou expirado.",
      );
    }

    const user = await ctx.client.usuario.findFirst({ where: { email } });

    if (!user) {
      await failAuthAttemptWithCode(
        ctx.env,
        email,
        "NOT_FOUND",
        "Conta não encontrada.",
      );
    }

    const loggedInUser = user!;

    const token = await createSession(ctx, loggedInUser.id);
    ctx.sessionToken = token;
    ctx.usuario = {
      id: loggedInUser.uuid,
      internalId: loggedInUser.id,
      email: loggedInUser.email,
      nome: loggedInUser.nome,
      emailVerificadoEm: loggedInUser.emailVerificadoEm,
    };
    ctx.organizationId = null;
    ctx.role = null;

    return toSessionOutput(ctx, null);
  },

  sair: async (ctx: WebContext) => {
    if (ctx.sessionToken) {
      const { deleteSession } = await import("../lib/session");
      await deleteSession(ctx, ctx.sessionToken);
    }
    return { ok: true };
  },

  eu: async (ctx: WebContext) => {
    const { requireAuth } = await import("./auth-session");
    requireAuth(ctx);
    return toSessionOutput(ctx, null);
  },
};
