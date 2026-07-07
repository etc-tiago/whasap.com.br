import {
  beginAuthAttempt,
  criarOtp,
  derivarNomeDoEmail,
  failAuthAttemptWithCode,
  mascararEmail,
  notFound,
  preconditionFailed,
  rpcError,
  sendOtpEmail,
  verificarOtp,
} from "@whasap/api-core";
import {
  colunasUsuarioSessao,
  colunasUsuarioSomenteId,
  comTimestampsCriacao,
  comTimestampAtualizacao,
  fluxoAutenticacao,
  usuario,
} from "@whasap/db";
import { and, eq, gt, isNull } from "drizzle-orm";

import { createSession } from "../lib/session";
import type { WebContext } from "../types";
import { mapearSessaoParaSaida } from "./auth-session";

const LIMITE_PEDIDOS_OTP = 10;
const LIMITE_TENTATIVAS_INVALIDAS = 10;
const FLUXO_EXPIRA_HORAS = 24;

type TipoFluxo = "entrar" | "cadastrar";

function expiraEmFluxo(): Date {
  return new Date(Date.now() + FLUXO_EXPIRA_HORAS * 60 * 60 * 1000);
}

function redirectPathFluxo(tipo: TipoFluxo, hash: string): string {
  return tipo === "entrar" ? `/~/${hash}` : `/~/email/${hash}`;
}

async function carregarFluxoPorHash(ctx: WebContext, hash: string) {
  const fluxo = await ctx.db.query.fluxoAutenticacao.findFirst({
    where: and(eq(fluxoAutenticacao.hash, hash), gt(fluxoAutenticacao.expiraEm, new Date())),
  });

  if (!fluxo) {
    notFound("Fluxo inválido ou expirado. Comece novamente.");
  }

  return fluxo;
}

async function marcarFluxoBloqueado(ctx: WebContext, fluxoId: number) {
  await ctx.db
    .update(fluxoAutenticacao)
    .set(comTimestampAtualizacao({ bloqueadoEm: new Date() }))
    .where(eq(fluxoAutenticacao.id, fluxoId));
}

function mapaFluxoPublico(
  fluxo: typeof fluxoAutenticacao.$inferSelect,
  extras?: { otpEnviado?: boolean },
) {
  const bloqueado = Boolean(fluxo.bloqueadoEm);
  return {
    hash: fluxo.hash,
    tipo: fluxo.tipo,
    emailMascarado: mascararEmail(fluxo.email),
    nomeSugerido: fluxo.tipo === "cadastrar" ? derivarNomeDoEmail(fluxo.email) : null,
    bloqueado,
    pedidosOtpRestantes: Math.max(0, LIMITE_PEDIDOS_OTP - fluxo.pedidosOtp),
    tentativasInvalidasRestantes: Math.max(
      0,
      LIMITE_TENTATIVAS_INVALIDAS - fluxo.tentativasOtpInvalidas,
    ),
    redirectPathBloqueado:
      fluxo.tipo === "cadastrar" && bloqueado ? `/~/email/${fluxo.hash}/bloqueado` : null,
    otpEnviado: extras?.otpEnviado,
  };
}

export const fluxoAutenticacaoHandlers = {
  /** Inicia fluxo de entrada ou cadastro a partir do e-mail informado. */
  iniciarFluxo: async (ctx: WebContext, input: { email: string }) => {
    const email = input.email.toLowerCase();
    await beginAuthAttempt(ctx.env, email);

    const existente = await ctx.db.query.usuario.findFirst({
      where: and(eq(usuario.email, email), isNull(usuario.excluidoEm)),
      columns: colunasUsuarioSomenteId,
    });

    const tipo: TipoFluxo = existente ? "entrar" : "cadastrar";
    const hash = crypto.randomUUID();

    await ctx.db.insert(fluxoAutenticacao).values(
      comTimestampsCriacao({
        hash,
        email,
        tipo,
        expiraEm: expiraEmFluxo(),
      }),
    );

    return {
      hash,
      tipo,
      redirectPath: redirectPathFluxo(tipo, hash),
    };
  },

  /** Retorna estado público do fluxo para renderizar a etapa correta. */
  obterFluxo: async (ctx: WebContext, input: { hash: string }) => {
    const fluxo = await carregarFluxoPorHash(ctx, input.hash);
    return mapaFluxoPublico(fluxo);
  },

  /** Envia OTP vinculado ao fluxo (login: livre; cadastro: conta pedidos e bloqueia). */
  enviarOtpFluxo: async (ctx: WebContext, input: { hash: string }) => {
    const fluxo = await carregarFluxoPorHash(ctx, input.hash);

    if (fluxo.bloqueadoEm) {
      preconditionFailed("Fluxo bloqueado. Entre em contato conosco.");
    }

    await beginAuthAttempt(ctx.env, fluxo.email);

    if (fluxo.tipo === "entrar") {
      const existente = await ctx.db.query.usuario.findFirst({
        where: and(eq(usuario.email, fluxo.email), isNull(usuario.excluidoEm)),
        columns: colunasUsuarioSomenteId,
      });
      if (!existente) {
        await failAuthAttemptWithCode(ctx.env, fluxo.email, "NOT_FOUND", "Conta não encontrada.");
      }

      const code = await criarOtp(ctx, fluxo.email, "login");
      await sendOtpEmail(ctx.env, fluxo.email, code, "login");
      return { ok: true as const, bloqueado: false };
    }

    const proximosPedidos = fluxo.pedidosOtp + 1;
    if (proximosPedidos > LIMITE_PEDIDOS_OTP) {
      await marcarFluxoBloqueado(ctx, fluxo.id);
      return { ok: false as const, bloqueado: true };
    }

    const existente = await ctx.db.query.usuario.findFirst({
      where: and(eq(usuario.email, fluxo.email), isNull(usuario.excluidoEm)),
      columns: colunasUsuarioSomenteId,
    });
    if (existente) {
      rpcError("CONFLICT", "Este e-mail já possui conta. Volte ao início e entre.");
    }

    await ctx.db
      .update(fluxoAutenticacao)
      .set(
        comTimestampAtualizacao({
          pedidosOtp: proximosPedidos,
          bloqueadoEm: proximosPedidos >= LIMITE_PEDIDOS_OTP ? new Date() : null,
        }),
      )
      .where(eq(fluxoAutenticacao.id, fluxo.id));

    if (proximosPedidos >= LIMITE_PEDIDOS_OTP) {
      return { ok: false as const, bloqueado: true };
    }

    const code = await criarOtp(ctx, fluxo.email, "signup");
    await sendOtpEmail(ctx.env, fluxo.email, code, "signup");
    return { ok: true as const, bloqueado: false };
  },

  /** Valida OTP e cria sessão para login via fluxo. */
  entrarFluxo: async (ctx: WebContext, input: { hash: string; otp: string }) => {
    const fluxo = await carregarFluxoPorHash(ctx, input.hash);

    if (fluxo.tipo !== "entrar") {
      preconditionFailed("Este fluxo não é de entrada.");
    }

    if (fluxo.bloqueadoEm) {
      preconditionFailed("Fluxo bloqueado.");
    }

    await beginAuthAttempt(ctx.env, fluxo.email);

    const valid = await verificarOtp(ctx, fluxo.email, "login", input.otp);
    if (!valid) {
      await failAuthAttemptWithCode(
        ctx.env,
        fluxo.email,
        "UNAUTHORIZED",
        "Código inválido ou expirado.",
      );
    }

    const loggedInUser = await ctx.db.query.usuario.findFirst({
      where: and(eq(usuario.email, fluxo.email), isNull(usuario.excluidoEm)),
      columns: colunasUsuarioSessao,
    });

    if (!loggedInUser) {
      await failAuthAttemptWithCode(ctx.env, fluxo.email, "NOT_FOUND", "Conta não encontrada.");
    }

    const token = await createSession(ctx, loggedInUser!.id);
    ctx.sessionToken = token;
    ctx.usuario = {
      id: loggedInUser!.uuid,
      internalId: loggedInUser!.id,
      email: loggedInUser!.email,
      nome: loggedInUser!.nome,
      emailVerificadoEm: loggedInUser!.emailVerificadoEm,
    };
    ctx.organizationId = null;
    ctx.role = null;

    return mapearSessaoParaSaida(ctx, null);
  },

  /** Valida OTP e cria conta via fluxo de cadastro. */
  cadastrarFluxo: async (
    ctx: WebContext,
    input: { hash: string; otp: string; lgpdConsent: true },
  ) => {
    const fluxo = await carregarFluxoPorHash(ctx, input.hash);

    if (fluxo.tipo !== "cadastrar") {
      preconditionFailed("Este fluxo não é de cadastro.");
    }

    if (fluxo.bloqueadoEm) {
      preconditionFailed("Fluxo bloqueado. Entre em contato conosco.");
    }

    await beginAuthAttempt(ctx.env, fluxo.email);

    const valid = await verificarOtp(ctx, fluxo.email, "signup", input.otp);
    if (!valid) {
      const proximasTentativas = fluxo.tentativasOtpInvalidas + 1;
      await ctx.db
        .update(fluxoAutenticacao)
        .set(
          comTimestampAtualizacao({
            tentativasOtpInvalidas: proximasTentativas,
            bloqueadoEm: proximasTentativas >= LIMITE_TENTATIVAS_INVALIDAS ? new Date() : null,
          }),
        )
        .where(eq(fluxoAutenticacao.id, fluxo.id));

      if (proximasTentativas >= LIMITE_TENTATIVAS_INVALIDAS) {
        rpcError("PRECONDITION_FAILED", "Muitas tentativas inválidas. Entre em contato conosco.");
      }

      await failAuthAttemptWithCode(
        ctx.env,
        fluxo.email,
        "UNAUTHORIZED",
        "Código inválido ou expirado.",
      );
    }

    const existente = await ctx.db.query.usuario.findFirst({
      where: and(eq(usuario.email, fluxo.email), isNull(usuario.excluidoEm)),
      columns: colunasUsuarioSomenteId,
    });
    if (existente) {
      rpcError("CONFLICT", "Este e-mail já possui conta.");
    }

    const now = new Date();
    const nome = derivarNomeDoEmail(fluxo.email);

    const [user] = await ctx.db
      .insert(usuario)
      .values(
        comTimestampsCriacao({
          email: fluxo.email,
          nome,
          emailVerificadoEm: now,
          lgpdConsentidoEm: now,
        }),
      )
      .returning();

    const token = await createSession(ctx, user!.id);
    ctx.sessionToken = token;
    ctx.usuario = {
      id: user!.uuid,
      internalId: user!.id,
      email: user!.email,
      nome: user!.nome,
      emailVerificadoEm: user!.emailVerificadoEm,
    };
    ctx.organizationId = null;
    ctx.role = null;

    return mapearSessaoParaSaida(ctx, null);
  },
};
