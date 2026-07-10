import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const PACOTE_DIR = resolve(import.meta.dirname, "..");

export type R2SyncConfig = {
  accountId: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucket: string;
  outputDir: string;
  prefixes: string[];
  concurrency: number;
  manifestPath: string;
};

function parseEnvFile(path: string): Record<string, string> {
  if (!existsSync(path)) return {};

  const vars: Record<string, string> = {};
  const raw = readFileSync(path, "utf8");

  for (const line of raw.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;

    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    vars[key] = value;
  }

  return vars;
}

function loadEnvCascade(): Record<string, string> {
  const fromProcess = Object.fromEntries(
    Object.entries(process.env).filter((entry): entry is [string, string] => Boolean(entry[1])),
  );

  return {
    ...parseEnvFile(resolve(PACOTE_DIR, ".env")),
    ...parseEnvFile(resolve(PACOTE_DIR, ".env.local")),
    ...fromProcess,
  };
}

function exigir(env: Record<string, string>, key: string): string {
  const value = env[key]?.trim();
  if (!value) {
    throw new Error(`Variável obrigatória ausente: ${key} (defina em packages/r2-sync/.env.local)`);
  }
  return value;
}

function parsePrefixes(raw: string | undefined): string[] {
  const value = raw?.trim() || "acao/,webhook/";
  return value
    .split(",")
    .map((prefix) => prefix.trim())
    .filter(Boolean);
}

function parseConcurrency(raw: string | undefined): number {
  const parsed = Number.parseInt(raw?.trim() || "8", 10);
  if (!Number.isFinite(parsed) || parsed < 1) {
    throw new Error("R2_CONCURRENCY deve ser um inteiro >= 1");
  }
  return parsed;
}

/** Carrega config do pacote (.env → .env.local → process.env). */
export function carregarConfig(): R2SyncConfig {
  const env = loadEnvCascade();
  const outputDir = resolve(PACOTE_DIR, env.R2_OUTPUT_DIR?.trim() || "./json");

  return {
    accountId: exigir(env, "CLOUDFLARE_ACCOUNT_ID"),
    accessKeyId: exigir(env, "R2_ACCESS_KEY_ID"),
    secretAccessKey: exigir(env, "R2_SECRET_ACCESS_KEY"),
    bucket: env.R2_BUCKET?.trim() || "whasap",
    outputDir,
    prefixes: parsePrefixes(env.R2_PREFIXES),
    concurrency: parseConcurrency(env.R2_CONCURRENCY),
    manifestPath: resolve(PACOTE_DIR, ".manifest.json"),
  };
}
