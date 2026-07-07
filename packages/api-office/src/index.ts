import { criarDb } from "@whasap/db";
import { createRpcHandler, getClientIp } from "@whasap/api-core";

import { resolveSession, SESSION_COOKIE, SESSION_MAX_AGE_SECONDS } from "./lib/session";
import { router } from "./router";
import type { OfficeContext, OfficeEnv } from "./types";

const handleRpc = createRpcHandler<OfficeContext>({
  router,
  session: {
    cookieName: SESSION_COOKIE,
    maxAgeSeconds: SESSION_MAX_AGE_SECONDS,
    loginPaths: ["/autenticacao/entrar"],
    logoutPath: "/autenticacao/sair",
  },
  buildContext: async (env, request, sessionToken) => {
    const officeEnv = env as OfficeEnv;
    const { db, sql } = criarDb(officeEnv.HYPERDRIVE.connectionString);
    const fecharDb = () => sql.end({ timeout: 5 });
    const partialCtx = { db, env: officeEnv, request, clientIp: undefined, fecharDb } as OfficeContext;
    const session = await resolveSession(partialCtx, sessionToken);

    return {
      db,
      env: officeEnv,
      request,
      clientIp: getClientIp(request),
      officeUsuario: session.officeUsuario,
      sessionToken,
      fecharDb,
    };
  },
});

export { handleRpc };
export type { OfficeContext, OfficeEnv } from "./types";
