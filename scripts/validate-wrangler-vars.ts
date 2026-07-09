#!/usr/bin/env bun
/**
 * Garante que `vars` nos wrangler.jsonc batem com packages/config/src/public-urls.ts.
 * Uso: bun run validate:env
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { workerVarsProduction } from "../packages/config/src/public-urls.ts";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const apps: Array<{ app: string; keys: readonly (keyof typeof workerVarsProduction)[] }> = [
  {
    app: "web",
    keys: ["WEB_URL", "OFFICE_URL", "WEBHOOK_URL", "CDN_URL", "EMAIL_FROM"],
  },
  {
    app: "office",
    keys: ["WEB_URL", "OFFICE_URL", "EMAIL_FROM"],
  },
  {
    app: "webhook",
    keys: ["CDN_URL"],
  },
];

function parseWranglerVars(app: string): Record<string, string> {
  const file = path.join(root, "apps", app, "wrangler.jsonc");
  const raw = readFileSync(file, "utf8");
  const varsMatch = raw.match(/"vars"\s*:\s*\{([\s\S]*?)\n\s*\}/);
  if (!varsMatch) return {};

  const vars: Record<string, string> = {};
  const pairRe = /"([^"]+)"\s*:\s*"([^"]*)"/g;
  for (const match of varsMatch[1].matchAll(pairRe)) {
    vars[match[1]!] = match[2]!;
  }
  return vars;
}

let failed = false;

for (const { app, keys } of apps) {
  const vars = parseWranglerVars(app);
  for (const key of keys) {
    const expected = workerVarsProduction[key];
    const actual = vars[key];
    if (actual !== expected) {
      console.error(
        `[validate:env] apps/${app}/wrangler.jsonc: ${key} = ${JSON.stringify(actual)}; esperado ${JSON.stringify(expected)}`,
      );
      failed = true;
    }
  }
}

if (failed) {
  console.error("\nAtualize wrangler.jsonc ou packages/config/src/public-urls.ts.");
  process.exit(1);
}

console.log("validate:env OK — wrangler vars em sync com public-urls.ts");
