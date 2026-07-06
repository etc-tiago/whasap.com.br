import {
  beginAuthAttempt,
  createOtp,
  failAuthAttemptWithCode,
  sendOtpEmail,
  slugify,
  verifyOtp,
  verifyTurnstile,
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
  turnstileToken: string;
};

type EntrarInput = {
  email: string;
  otp: string;
  turnstileToken: string;
};

type CadastrarInput = {
  email: string;
  nome: string;
  nomeOrganizacao: string;
  otp: string;
  lgpdConsent: true;
  turnstileToken: string;
};

export const autenticacaoHandlers = {
  enviarOtp: async (ctx: WebContext, input: EnviarOtpInput) => {
    await verifyTurnstile(ctx.env, input.turnstileToken, ctx.clientIp);
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
    await verifyTurnstile(ctx.env, input.turnstileToken, ctx.clientIp);
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
    let slug = slugify(input.nomeOrganizacao);
    const slugConflict = await ctx.client.organizations.findFirst({
      where: { slug },
      select: { id: true },
    });
    if (slugConflict) slug = `${slug}-${crypto.randomUUID().slice(0, 8)}`;

    const user = await ctx.client.usuario.create({
      data: appCreateData({
        email,
        nome: input.nome,
        emailVerificadoEm: now,
        lgpdConsentidoEm: now,
      }),
    });

    const org = await ctx.client.organizations.create({
      data: appCreateData({
        name: input.nomeOrganizacao,
        slug,
      }),
    });

    await ctx.client.organizationMembers.create({
      data: appCreateData({
        organizationId: org.id,
        usuarioId: user.id,
        role: "admin",
        joinedAt: now,
      }),
    });

    const token = await createSession(ctx, user.id, org.id);
    ctx.sessionToken = token;
    ctx.usuario = {
      id: user.uuid,
      internalId: user.id,
      email: user.email,
      nome: user.nome,
      emailVerificadoEm: user.emailVerificadoEm,
    };
    ctx.organizationId = org.id;
    ctx.role = "admin";

    return toSessionOutput(ctx, org);
  },

  entrar: async (ctx: WebContext, input: EntrarInput) => {
    await verifyTurnstile(ctx.env, input.turnstileToken, ctx.clientIp);
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

    const membership = await ctx.client.organizationMembers.findFirst({
      where: { usuarioId: loggedInUser.id },
      include: { organization: true },
    });

    const token = await createSession(
      ctx,
      loggedInUser.id,
      membership?.organizationId ?? undefined,
    );
    ctx.sessionToken = token;
    ctx.usuario = {
      id: loggedInUser.uuid,
      internalId: loggedInUser.id,
      email: loggedInUser.email,
      nome: loggedInUser.nome,
      emailVerificadoEm: loggedInUser.emailVerificadoEm,
    };
    ctx.organizationId = membership?.organizationId ?? null;
    ctx.role = membership?.role ?? null;

    return toSessionOutput(ctx, membership?.organization ?? null);
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
    let org = null;
    if (ctx.organizationId) {
      org = await ctx.client.organizations.findFirst({
        where: { id: ctx.organizationId },
      });
    }
    return toSessionOutput(ctx, org);
  },
};