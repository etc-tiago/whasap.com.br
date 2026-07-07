import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import * as schema from "./schema";

/**
 * Cria cliente Drizzle com query API relacional e `casing: snake_case`.
 * Usa `postgres.js` — compatível com Hyperdrive (TCP) em Workers.
 *
 * @param connectionString - `env.HYPERDRIVE.connectionString` em produção.
 * @returns `{ db, sql }` — encerre com `await sql.end({ timeout: 5 })` ao fim do request.
 */
export function criarDb(connectionString: string) {
  const sql = postgres(connectionString, {
    prepare: false,
    max: 1,
    fetch_types: false,
  });
  const db = drizzle({ client: sql, schema, casing: "snake_case" });
  return { db, sql };
}

export type Db = ReturnType<typeof criarDb>["db"];
export { schema };
