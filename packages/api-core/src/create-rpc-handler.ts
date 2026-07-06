import { onError } from "@orpc/server";
import { RPCHandler } from "@orpc/server/fetch";

export type RpcSessionConfig = {
  cookieName: string;
  maxAgeSeconds: number;
  loginPaths: string[];
  logoutPath: string;
};

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

export function createRpcHandler<TContext extends { sessionToken: string | null }>(options: {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  router: any;
  session: RpcSessionConfig;
  buildContext: (env: unknown, request: Request, sessionToken: string | null) => Promise<TContext>;
}) {
  const cookieHelpers = createSessionCookieHelpers(options.session.cookieName);
  const rpcHandler = new RPCHandler(options.router, {
    interceptors: [onError((error) => console.error(error))],
  });

  return async function handleRpc(request: Request, env: unknown): Promise<Response> {
    const sessionToken = cookieHelpers.getSessionTokenFromRequest(request);
    const ctx = await options.buildContext(env, request, sessionToken);
    const path = new URL(request.url).pathname;

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
  };
}
