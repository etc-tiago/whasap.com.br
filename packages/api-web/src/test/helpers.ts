import { createORPCClient } from "@orpc/client";
import { RPCLink } from "@orpc/client/fetch";
import type { ContractRouterClient } from "@orpc/contract";
import { criarDb, codigoOtp, fluxoAutenticacao, sessao, usuario } from "@whasap/db";
import type { webContract } from "@whasap/orpc/web";
import { and, desc, eq, isNull } from "drizzle-orm";

import { handleRpc } from "../index";
import { SESSION_COOKIE } from "../lib/session";
import type { WebEnv } from "../types";

const RPC_BASE = "http://test.local/rpc";

export function emailTesteUnico(): string {
  return `test+${crypto.randomUUID()}@whasap.test`;
}

export function createTestWebEnv(overrides?: Partial<WebEnv>): WebEnv {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("DATABASE_URL não configurado");
  }

  return {
    HYPERDRIVE: { connectionString: databaseUrl },
    EMAIL_FROM: "noreply@localhost",
    WEB_URL: "http://localhost:3000",
    OFFICE_URL: "http://localhost:3001",
    WEBHOOK_URL: "http://localhost:8788",
    CDN_URL: "http://localhost:8789",
    WEB_SESSION_JWT_SECRET: "test-jwt-secret",
    ASSAS_API_KEY: "test-asaas-key",
    ASAAS_SANDBOX: "true",
    EVOLUTION_SECRETS_STORE: JSON.stringify({
      baseUrl: "http://localhost:8080",
      apiKey: "test-evolution-key",
    }),
    ...overrides,
  };
}

class CookieJar {
  private cookies = new Map<string, string>();

  ingest(response: Response): void {
    for (const header of response.headers.getSetCookie()) {
      const [pair] = header.split(";");
      const eq = pair?.indexOf("=");
      if (eq === undefined || eq < 0) continue;
      const name = pair.slice(0, eq).trim();
      const value = pair.slice(eq + 1).trim();
      if (!value) {
        this.cookies.delete(name);
      } else {
        this.cookies.set(name, value);
      }
    }
  }

  header(): string | undefined {
    if (this.cookies.size === 0) return undefined;
    return [...this.cookies.entries()].map(([k, v]) => `${k}=${v}`).join("; ");
  }

  hasSessionCookie(): boolean {
    return this.cookies.has(SESSION_COOKIE);
  }
}

export type TestRpcHarness = {
  client: ContractRouterClient<typeof webContract>;
  cookieJar: CookieJar;
};

export function createTestOrpcClient(env: WebEnv): TestRpcHarness {
  const cookieJar = new CookieJar();

  const link = new RPCLink({
    url: () => RPC_BASE,
    fetch: async (input, init) => {
      const headers = new Headers(init?.headers);
      const cookie = cookieJar.header();
      if (cookie) {
        headers.set("cookie", cookie);
      }

      const response = await handleRpc(
        new Request(input, {
          ...init,
          headers,
        }),
        env,
      );

      cookieJar.ingest(response);
      return response;
    },
  });

  return {
    client: createORPCClient<ContractRouterClient<typeof webContract>>(link),
    cookieJar,
  };
}

export async function buscarUltimoOtp(
  email: string,
  finalidade: string,
): Promise<string> {
  const { db, sql } = criarDb(process.env.DATABASE_URL!);
  try {
    const [row] = await db
      .select({ codigo: codigoOtp.codigo })
      .from(codigoOtp)
      .where(
        and(
          eq(codigoOtp.email, email.toLowerCase()),
          eq(codigoOtp.finalidade, finalidade),
          isNull(codigoOtp.usadoEm),
        ),
      )
      .orderBy(desc(codigoOtp.criadoEm))
      .limit(1);

    if (!row) {
      throw new Error(`OTP não encontrado para ${email} (${finalidade})`);
    }

    return row.codigo;
  } finally {
    await sql.end({ timeout: 5 });
  }
}

export async function limparDadosTeste(email: string): Promise<void> {
  const normalized = email.toLowerCase();
  const { db, sql } = criarDb(process.env.DATABASE_URL!);
  try {
    const user = await db.query.usuario.findFirst({
      where: eq(usuario.email, normalized),
      columns: { id: true },
    });

    if (user) {
      await db.delete(sessao).where(eq(sessao.usuarioId, user.id));
      await db.delete(usuario).where(eq(usuario.id, user.id));
    }

    await db.delete(codigoOtp).where(eq(codigoOtp.email, normalized));
    await db.delete(fluxoAutenticacao).where(eq(fluxoAutenticacao.email, normalized));
  } finally {
    await sql.end({ timeout: 5 });
  }
}

export async function rpcRaw(
  env: WebEnv,
  path: string,
  init?: RequestInit,
): Promise<Response> {
  const url = path.startsWith("http") ? path : `${RPC_BASE}${path.startsWith("/") ? path : `/${path}`}`;
  return handleRpc(new Request(url, init), env);
}
