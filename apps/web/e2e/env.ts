import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

/** Carrega `DATABASE_URL` do `.env` na raiz (ou fallback local) para o runner e2e. */
export function carregarEnvE2e(): void {
  const rootEnvPath = resolve(import.meta.dirname, "../../../.env");

  if (!process.env.DATABASE_URL && existsSync(rootEnvPath)) {
    for (const line of readFileSync(rootEnvPath, "utf8").split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eqIndex = trimmed.indexOf("=");
      if (eqIndex === -1) continue;
      const key = trimmed.slice(0, eqIndex).trim();
      const value = trimmed.slice(eqIndex + 1).trim();
      if (key === "DATABASE_URL" && !process.env.DATABASE_URL) {
        process.env.DATABASE_URL = value;
      }
    }
  }

  if (!process.env.DATABASE_URL) {
    process.env.DATABASE_URL = "postgres://postgres:postgres@db.localtest.me:5432/whasap";
  }
}
