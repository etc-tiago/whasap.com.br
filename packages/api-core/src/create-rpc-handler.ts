import { onError } from "@orpc/server";
import { RPCHandler } from "@orpc/server/fetch";

import { registrarErro } from "@whasap/evlog";

export type RpcSessionConfig = {
  cookieName: string;
  maxAgeSeconds: number;
  loginPaths: string[];
  logoutPath: string;
};

/** Helpers de cookie de sessão para handlers RPC (web e office). */
export function createSessionCookieHelpers(cookieName: string) {
  return {
    getSessionTokenFromRequest(request: Request): string | null {
      const cookie = request.headers.get("cookie") ?? "";
      const match = cookie.match(new RegExp(`${cookieName}=([^;]+)`));
      return match?.[1] ?? null;
    },
    sessionCookieHeader(token: string, maxAgeSeconds: number): string {
      return `${cookieName}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAgeSeconds}`;
    },
    clearSessionCookieHeader(): string {
      return `${cookieName}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`;
    },
  };
}

/**
 * Monta handler HTTP `/rpc` com contexto, cookies de sessão e interceptors.
 * Usado por `apps/web` e `apps/office`.
 */
export function createRpcHandler<TContext extends { sessionToken: string | null; fecharDb?: () => Promise<void> }>(options: {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  router: any;
  session: RpcSessionConfig;
  buildContext: (env: unknown, request: Request, sessionToken: string | null) => Promise<TContext>;
}) {
  const cookieHelpers = createSessionCookieHelpers(options.session.cookieName);
  const rpcHandler = new RPCHandler(options.router, {
    interceptors: [onError((error) => registrarErro("rpc", error))],
  });

  return async function handleRpc(request: Request, env: unknown): Promise<Response> {
    const sessionToken = cookieHelpers.getSessionTokenFromRequest(request);
    const ctx = await options.buildContext(env, request, sessionToken);
    const path = new URL(request.url).pathname;

    try {
      const { matched, response } = await rpcHandler.handle(request, {
        prefix: "/rpc",
        context: ctx,
      });

      if (!matched) {
        return new Response("Not Found", { status: 404 });
      }

      const headers = new Headers(response.headers);
      if (
        ctx.sessionToken &&
        options.session.loginPaths.some((loginPath) => path.endsWith(loginPath))
      ) {
        headers.append(
          "Set-Cookie",
          cookieHelpers.sessionCookieHeader(ctx.sessionToken, options.session.maxAgeSeconds),
        );
      }
      if (path.endsWith(options.session.logoutPath)) {
        headers.append("Set-Cookie", cookieHelpers.clearSessionCookieHeader());
      }

      return new Response(response.body, { status: response.status, headers });
    } finally {
      await ctx.fecharDb?.();
    }
  };
}
