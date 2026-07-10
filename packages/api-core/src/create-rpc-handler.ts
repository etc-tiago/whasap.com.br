import { onError, ORPCError } from "@orpc/server";
import { StandardRPCJsonSerializer } from "@orpc/client/standard";
import { RPCHandler } from "@orpc/server/fetch";
import { toFetchResponse } from "@orpc/standard-server-fetch";

import { registrarErro } from "@whasap/evlog";

import { emitirJwtSessao, verificarJwtSessao, type SessionJwtAudience } from "./lib/session-jwt";

export type { SessionJwtAudience } from "./lib/session-jwt";
export { emitirJwtSessao, verificarJwtSessao } from "./lib/session-jwt";

export type RpcSessionConfig = {
  cookieName: string;
  maxAgeSeconds: number;
  loginPaths: string[];
  logoutPath: string;
  publicPaths: string[];
  jwt: {
    resolveSecret: (env: unknown) => string | Promise<string>;
    audience: SessionJwtAudience;
  };
};

/** Helpers de cookie de sessão para handlers RPC (web e office). */
export function createSessionCookieHelpers(cookieName: string) {
  return {
    getSessionTokenFromRequest(request: Request): string | null {
      const cookie = request.headers.get("cookie") ?? "";
      const match = cookie.match(new RegExp(`${cookieName}=([^;]+)`));
      return match?.[1] ?? null;
    },
    sessionCookieHeader(token: string, maxAgeSeconds: number, secure = false): string {
      const secureFlag = secure ? "; Secure" : "";
      return `${cookieName}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAgeSeconds}${secureFlag}`;
    },
    clearSessionCookieHeader(secure = false): string {
      const secureFlag = secure ? "; Secure" : "";
      return `${cookieName}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${secureFlag}`;
    },
  };
}

/** Path do procedimento ORPC após o prefixo `/rpc` (ex.: `/autenticacao/entrarFluxo`). */
function rpcProcedurePath(request: Request, prefix: string): string {
  const pathname = new URL(request.url).pathname;
  const normalizedPrefix = prefix.replace(/\/$/, "");
  if (
    normalizedPrefix &&
    pathname !== normalizedPrefix &&
    !pathname.startsWith(`${normalizedPrefix}/`)
  ) {
    return "";
  }
  if (pathname === normalizedPrefix) return "";
  return pathname.slice(normalizedPrefix.length);
}

function matchesRpcProcedurePath(procedurePath: string, configuredPath: string): boolean {
  const normalized = configuredPath.startsWith("/") ? configuredPath : `/${configuredPath}`;
  return procedurePath === normalized || procedurePath.endsWith(normalized);
}

function isLoginRpcProcedure(request: Request, prefix: string, loginPaths: string[]): boolean {
  const procedurePath = rpcProcedurePath(request, prefix);
  if (!procedurePath) return false;
  return loginPaths.some((loginPath) => matchesRpcProcedurePath(procedurePath, loginPath));
}

function isPublicRpcProcedure(request: Request, prefix: string, publicPaths: string[]): boolean {
  const procedurePath = rpcProcedurePath(request, prefix);
  if (!procedurePath) return false;
  return publicPaths.some((publicPath) => matchesRpcProcedurePath(procedurePath, publicPath));
}

function resolveSecureCookie(request: Request): boolean {
  const url = new URL(request.url);
  if (url.protocol === "https:") return true;

  const forwardedProto = request.headers.get("x-forwarded-proto");
  if (forwardedProto?.split(",")[0]?.trim() === "https") return true;

  return request.headers.get("cf-visitor")?.includes('"scheme":"https"') ?? false;
}

/** Estado mutável de sessão compartilhado entre clones do contexto ORPC. */
export type EstadoSessaoRpc = {
  token: string | null;
  expiraEm: Date | null;
};

function estadoSessaoDoContexto(ctx: { estadoSessao?: EstadoSessaoRpc }): EstadoSessaoRpc {
  if (!ctx.estadoSessao) {
    throw new Error("estadoSessao ausente no contexto RPC");
  }
  return ctx.estadoSessao;
}

/** Atribui token opaco e expiração após login/cadastro (sobrevive ao clone do ORPC). */
export function atribuirSessaoRpc(
  ctx: {
    estadoSessao?: EstadoSessaoRpc;
    sessionToken?: string | null;
    sessionExpiraEm?: Date | null;
  },
  token: string,
  expiraEm: Date,
): void {
  const estado = estadoSessaoDoContexto(ctx);
  estado.token = token;
  estado.expiraEm = expiraEm;
  ctx.sessionToken = token;
  ctx.sessionExpiraEm = expiraEm;
}

/** Limpa sessão após logout (sobrevive ao clone do ORPC). */
export function limparSessaoRpc(ctx: {
  estadoSessao?: EstadoSessaoRpc;
  sessionToken?: string | null;
  sessionExpiraEm?: Date | null;
}): void {
  const estado = estadoSessaoDoContexto(ctx);
  estado.token = null;
  estado.expiraEm = null;
  ctx.sessionToken = null;
  ctx.sessionExpiraEm = null;
}

function appendSessionCookie(
  headers: Headers,
  cookieHelpers: ReturnType<typeof createSessionCookieHelpers>,
  token: string,
  maxAgeSeconds: number,
  secure: boolean,
): void {
  headers.append("Set-Cookie", cookieHelpers.sessionCookieHeader(token, maxAgeSeconds, secure));
}

const rpcSerializer = new StandardRPCJsonSerializer();

function rpcUnauthorizedResponse(): Response {
  const error = new ORPCError("UNAUTHORIZED", { message: "Não autenticado" });
  return toFetchResponse({
    status: error.status,
    headers: { "content-type": "application/json" },
    body: rpcSerializer.serialize(error.toJSON()),
  });
}

async function resolveOpaqueSessionToken(
  cookieValue: string | null,
  jwtConfig: RpcSessionConfig["jwt"],
  env: unknown,
): Promise<string | null> {
  if (!cookieValue) return null;
  const secret = await Promise.resolve(jwtConfig.resolveSecret(env));
  const verified = await verificarJwtSessao(cookieValue, {
    secret,
    audience: jwtConfig.audience,
  });
  return verified?.token ?? null;
}

/**
 * Monta handler HTTP `/rpc` com contexto, cookies de sessão JWT e interceptors.
 * Usado por `apps/web` e `apps/office`.
 */
export function createRpcHandler<
  TContext extends {
    sessionToken: string | null;
    sessionExpiraEm?: Date | null;
    estadoSessao?: EstadoSessaoRpc;
    fecharDb?: () => Promise<void>;
  },
>(options: {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  router: any;
  session: RpcSessionConfig;
  buildContext: (env: unknown, request: Request, sessionToken: string | null) => Promise<TContext>;
}) {
  const cookieHelpers = createSessionCookieHelpers(options.session.cookieName);
  const rpcHandler = new RPCHandler(options.router, {
    interceptors: [onError((error) => registrarErro("rpc", error))],
  });
  const rpcPrefix = "/rpc";

  return async function handleRpc(request: Request, env: unknown): Promise<Response> {
    const jwtSecret = await Promise.resolve(options.session.jwt.resolveSecret(env));

    const procedurePath = rpcProcedurePath(request, rpcPrefix);
    const isPublic =
      procedurePath !== "" && isPublicRpcProcedure(request, rpcPrefix, options.session.publicPaths);
    const incomingCookie = cookieHelpers.getSessionTokenFromRequest(request);

    let opaqueSessionToken: string | null = null;

    if (!isPublic) {
      if (!incomingCookie) {
        return rpcUnauthorizedResponse();
      }
      opaqueSessionToken = await resolveOpaqueSessionToken(
        incomingCookie,
        options.session.jwt,
        env,
      );
      if (!opaqueSessionToken) {
        return rpcUnauthorizedResponse();
      }
    } else if (incomingCookie) {
      opaqueSessionToken = await resolveOpaqueSessionToken(
        incomingCookie,
        options.session.jwt,
        env,
      );
    }

    const ctx = await options.buildContext(env, request, opaqueSessionToken);
    const estadoSessao: EstadoSessaoRpc = {
      token: opaqueSessionToken,
      expiraEm: ctx.sessionExpiraEm ?? null,
    };
    ctx.estadoSessao = estadoSessao;
    const secureCookie = resolveSecureCookie(request);

    try {
      const { matched, response } = await rpcHandler.handle(request, {
        prefix: rpcPrefix,
        context: ctx,
      });

      if (!matched) {
        return new Response("Not Found", { status: 404 });
      }

      const headers = new Headers(response.headers);
      const finalOpaqueToken = estadoSessao.token;
      const sessionRotated = finalOpaqueToken != null && finalOpaqueToken !== opaqueSessionToken;
      const loginProcedure =
        response.ok &&
        finalOpaqueToken != null &&
        isLoginRpcProcedure(request, rpcPrefix, options.session.loginPaths);
      const sessionEnded = opaqueSessionToken != null && finalOpaqueToken == null;

      if ((sessionRotated || loginProcedure) && finalOpaqueToken) {
        const expiraEm =
          estadoSessao.expiraEm ?? new Date(Date.now() + options.session.maxAgeSeconds * 1000);
        const jwt = await emitirJwtSessao({
          token: finalOpaqueToken,
          expiraEm,
          audience: options.session.jwt.audience,
          secret: jwtSecret,
        });
        appendSessionCookie(
          headers,
          cookieHelpers,
          jwt,
          options.session.maxAgeSeconds,
          secureCookie,
        );
      }
      if (sessionEnded) {
        headers.append("Set-Cookie", cookieHelpers.clearSessionCookieHeader(secureCookie));
      }

      return new Response(response.body, { status: response.status, headers });
    } finally {
      await ctx.fecharDb?.();
    }
  };
}
