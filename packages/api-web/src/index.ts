import { criarDb } from "@whasap/db";
import { createRpcHandler, getClientIp } from "@whasap/api-core";

import {
  resolveSession,
  SESSION_COOKIE,
  SESSION_MAX_AGE_SECONDS,
  getSessionTokenFromRequest,
} from "./lib/session";
import { router } from "./router";
import type { WebContext, WebEnv } from "./types";

const handleRpc = createRpcHandler<WebContext>({
  router,
  session: {
    cookieName: SESSION_COOKIE,
    maxAgeSeconds: SESSION_MAX_AGE_SECONDS,
    loginPaths: [
      "/autenticacao/cadastrar",
      "/autenticacao/entrar",
      "/autenticacao/cadastrarFluxo",
      "/autenticacao/entrarFluxo",
    ],
    logoutPath: "/autenticacao/sair",
  },
  buildContext: async (env, request, sessionToken) => {
    const webEnv = env as WebEnv;
    const { db, sql } = criarDb(webEnv.HYPERDRIVE.connectionString);
    const fecharDb = () => sql.end({ timeout: 5 });
    const partialCtx = { db, env: webEnv, request, clientIp: undefined, fecharDb } as WebContext;
    const session = await resolveSession(partialCtx, sessionToken);

    return {
      db,
      env: webEnv,
      request,
      clientIp: getClientIp(request),
      usuario: session.usuario,
      organizationId: session.organizationId,
      role: session.role,
      sessionToken,
      fecharDb,
    };
  },
});

export { handleRpc, getSessionTokenFromRequest };
export type { WebContext, WebEnv } from "./types";
