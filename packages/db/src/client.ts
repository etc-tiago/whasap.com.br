import { softDelete } from "@better-drizzle/soft-delete";
import { timestamps } from "@better-drizzle/timestamps";
import { neon } from "@neondatabase/serverless";
import { better } from "better-drizzle";
import { drizzle } from "drizzle-orm/neon-http";

import * as schema from "./schema";

export function createDb(connectionString: string) {
  const sql = neon(connectionString);
  const db = drizzle({ client: sql, schema, casing: "snake_case" });
  const client = better(db, {
    schema,
    plugins: [
      timestamps({
        createdAt: "criadoEm",
        updatedAt: "atualizadoEm",
        mode: "app",
      }),
      softDelete({
        column: "excluidoEm",
        defaults: { mode: "soft", visibility: "without" },
      }),
    ],
  });
  return { db, client };
}

export type Db = ReturnType<typeof createDb>["db"];
export type Client = ReturnType<typeof createDb>["client"];
export { schema };
