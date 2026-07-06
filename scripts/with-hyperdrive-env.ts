#!/usr/bin/env bun
/**
 * Wrangler Hyperdrive local dev reads CLOUDFLARE_HYPERDRIVE_LOCAL_CONNECTION_STRING_HYPERDRIVE
 * from process.env only — not from .dev.vars. Maps DATABASE_URL when unset.
 */
const hyperdriveVar = "CLOUDFLARE_HYPERDRIVE_LOCAL_CONNECTION_STRING_HYPERDRIVE";

if (!process.env[hyperdriveVar]) {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error(
      `Missing ${hyperdriveVar} or DATABASE_URL.\n` +
        "Add DATABASE_URL to the monorepo root .env (see .env.example).",
    );
    process.exit(1);
  }
  process.env[hyperdriveVar] = databaseUrl;
}

const [command, ...args] = Bun.argv.slice(2);
if (!command) {
  console.error("Usage: with-hyperdrive-env.ts <command> [args...]");
  process.exit(1);
}

const proc = Bun.spawn([command, ...args], {
  stdio: ["inherit", "inherit", "inherit"],
  env: process.env,
});

process.exit(await proc.exited);
