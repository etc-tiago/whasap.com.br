import { criarDb } from "@whasap/db";
import { createRpcHandler, getClientIp, resolveSessionJwtSecret } from "@whasap/api-core";

import {
  resolveSession,
  SESSION_COOKIE,
  SESSION_MAX_AGE_SECONDS,
  getSessionTokenFromRequest,
} from "./lib/session";
import { router } from "./router";
import type { WebContext, WebEnv } from "./types";

const WEB_PUBLIC_PATHS = [
  "/saude/verificar",
  "/autenticacao/enviarOtp",
  "/autenticacao/cadastrar",
  "/autenticacao/entrar",
  "/autenticacao/iniciarFluxo",
  "/autenticacao/obterFluxo",
  "/autenticacao/enviarOtpFluxo",
  "/autenticacao/entrarFluxo",
  "/autenticacao/cadastrarFluxo",
  "/autenticacao/consumirLinkMagico",
  "/organizacao/convites/aceitar",
];

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
      "/autenticacao/consumirLinkMagico",
    ],
    logoutPath: "/autenticacao/sair",
    publicPaths: WEB_PUBLIC_PATHS,
    jwt: {
      resolveSecret: (env) =>
        resolveSessionJwtSecret((env as WebEnv).WEB_SESSION_JWT_SECRET, "WEB_SESSION_JWT_SECRET"),
      audience: "web",
    },
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
      sessionExpiraEm: null,
      fecharDb,
    };
  },
});

export { handleRpc, getSessionTokenFromRequest };
export type { WebContext, WebEnv } from "./types";
