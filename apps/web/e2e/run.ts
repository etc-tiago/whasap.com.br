import { type ChildProcess, spawn } from "node:child_process";
import { resolve } from "node:path";

import { E2E_APP_PORT, E2E_APP_URL } from "./constants";
import { carregarEnvE2e } from "./env";

carregarEnvE2e();

const STARTUP_TIMEOUT_MS = 90_000;
const POLL_MS = 250;

async function serverDisponivel(url: string): Promise<boolean> {
  try {
    const response = await fetch(url, { redirect: "manual" });
    return response.ok || response.status === 307 || response.status === 308;
  } catch {
    return false;
  }
}

async function waitForServer(url: string): Promise<void> {
  const deadline = Date.now() + STARTUP_TIMEOUT_MS;

  const poll = async (): Promise<void> => {
    if (await serverDisponivel(url)) return;
    if (Date.now() >= deadline) {
      throw new Error(`Dev server não respondeu em ${url} após ${STARTUP_TIMEOUT_MS}ms`);
    }
    await new Promise((resolveWait) => setTimeout(resolveWait, POLL_MS));
    return poll();
  };

  return poll();
}

function iniciarDevServer(appDir: string): ChildProcess {
  const viteJs = resolve(appDir, "node_modules/vite/bin/vite.js");
  const databaseUrl =
    process.env.DATABASE_URL ?? "postgres://postgres:postgres@db.localtest.me:5432/whasap";

  const proc = spawn("node", [viteJs, "dev", "--port", String(E2E_APP_PORT), "--strictPort"], {
    cwd: appDir,
    env: {
      ...process.env,
      DATABASE_URL: databaseUrl,
      CLOUDFLARE_HYPERDRIVE_LOCAL_CONNECTION_STRING_HYPERDRIVE: databaseUrl,
    },
    stdio: ["ignore", "pipe", "pipe"],
  });

  proc.stderr?.on("data", (chunk: Buffer) => {
    process.stderr.write(`[e2e-dev] ${chunk.toString()}`);
  });

  return proc;
}

function executarVitest(appDir: string, extraArgs: string[] = []): Promise<number> {
  return new Promise((resolveExit, reject) => {
    const proc = spawn("bun", ["vitest", "run", "--config", "vitest.e2e.config.ts", ...extraArgs], {
      cwd: appDir,
      env: process.env,
      stdio: "inherit",
    });

    proc.on("error", reject);
    proc.on("exit", (code) => resolveExit(code ?? 1));
  });
}

async function encerrarDevServer(proc: ChildProcess): Promise<void> {
  if (proc.killed) return;
  proc.kill("SIGTERM");
  await new Promise<void>((resolveKill) => {
    proc.once("exit", () => resolveKill());
    setTimeout(() => {
      proc.kill("SIGKILL");
      resolveKill();
    }, 5_000);
  });
}

const appDir = resolve(import.meta.dirname, "..");
let devProcess: ChildProcess | undefined;
let iniciouDevProcess = false;

try {
  if (!(await serverDisponivel(`${E2E_APP_URL}/~/`))) {
    devProcess = iniciarDevServer(appDir);
    iniciouDevProcess = true;
    await waitForServer(`${E2E_APP_URL}/~/`);
  }

  const extraArgs = process.argv.slice(2);
  const exitCode = await executarVitest(appDir, extraArgs);
  process.exitCode = exitCode;
} finally {
  if (iniciouDevProcess && devProcess) {
    await encerrarDevServer(devProcess);
  }
}
