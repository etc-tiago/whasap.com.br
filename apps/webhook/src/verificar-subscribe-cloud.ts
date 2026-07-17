import { criarDb, instancia } from "@whasap/db";
import { and, eq, isNull } from "drizzle-orm";

import type { Env } from "./env";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * Handshake Meta `GET /cloud`: `hub.verify_token` deve ser o UUID da conexão
 * (`instancia.uuid`) com provedor `meta_cloud` e não excluída.
 */
export async function verificarSubscribeCloud(
  env: Env,
  token: string | undefined,
): Promise<boolean> {
  if (!token || !UUID_RE.test(token)) return false;

  const { db, sql } = criarDb(env.HYPERDRIVE.connectionString);
  try {
    const row = await db.query.instancia.findFirst({
      where: and(
        eq(instancia.uuid, token),
        eq(instancia.provedor, "meta_cloud"),
        isNull(instancia.excluidoEm),
      ),
      columns: { id: true },
    });
    return Boolean(row);
  } finally {
    await sql.end({ timeout: 5 });
  }
}
