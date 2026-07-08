import { criarDb } from "@whasap/db";
import { createRpcHandler, getClientIp, resolveSessionJwtSecret } from "@whasap/api-core";

import { resolveSession, SESSION_COOKIE, SESSION_MAX_AGE_SECONDS } from "./lib/session";
import { router } from "./router";
import type { OfficeContext, OfficeEnv } from "./types";

const OFFICE_PUBLIC_PATHS = ["/autenticacao/enviarOtp", "/autenticacao/entrar"];

const handleRpc = createRpcHandler<OfficeContext>({
  router,
  session: {
    cookieName: SESSION_COOKIE,
    maxAgeSeconds: SESSION_MAX_AGE_SECONDS,
    loginPaths: ["/autenticacao/entrar"],
    logoutPath: "/autenticacao/sair",
    publicPaths: OFFICE_PUBLIC_PATHS,
    jwt: {
      resolveSecret: (env) =>
        resolveSessionJwtSecret(
          (env as OfficeEnv).OFFICE_SESSION_JWT_SECRET,
          "OFFICE_SESSION_JWT_SECRET",
        ),
      audience: "office",
    },
  },
  buildContext: async (env, request, sessionToken) => {
    const officeEnv = env as OfficeEnv;
    const { db, sql } = criarDb(officeEnv.HYPERDRIVE.connectionString);
    const fecharDb = () => sql.end({ timeout: 5 });
    const partialCtx = {
      db,
      env: officeEnv,
      request,
      clientIp: undefined,
      fecharDb,
    } as OfficeContext;
    const session = await resolveSession(partialCtx, sessionToken);

    return {
      db,
      env: officeEnv,
      request,
      clientIp: getClientIp(request),
      officeUsuario: session.officeUsuario,
      sessionToken,
      sessionExpiraEm: null,
      fecharDb,
    };
  },
});

export { handleRpc };
export type { OfficeContext, OfficeEnv } from "./types";
