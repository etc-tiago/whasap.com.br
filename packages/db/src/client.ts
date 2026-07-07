import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";

import * as schema from "./schema";

/**
 * Cria cliente Drizzle com query API relacional e `casing: snake_case`.
 * @param connectionString - URL Postgres (Hyperdrive em workers).
 * @returns `{ db }` — use `db.query`, `db.insert`, `db.update`, `db.select`.
 */
export function criarDb(connectionString: string) {
  const sql = neon(connectionString);
  const db = drizzle({ client: sql, schema, casing: "snake_case" });
  return { db };
}

export type Db = ReturnType<typeof criarDb>["db"];
export { schema };
