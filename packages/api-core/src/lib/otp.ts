import { mvpDefaults } from "@whasap/config";
import { codigoOtp, colunasCodigoOtpVerificacao, comCriadoEm } from "@whasap/db";
import { and, count, eq, gt, isNull } from "drizzle-orm";

import type { DbContext } from "../types";

function gerarCodigoOtp(): string {
  const n = crypto.getRandomValues(new Uint32Array(1))[0]! % 1_000_000;
  return n.toString().padStart(6, "0");
}

/** Conta OTPs enviados recentemente para rate limit. */
export async function contarOtpsRecentes(ctx: DbContext, email: string): Promise<number> {
  const desde = new Date(Date.now() - mvpDefaults.auth.otpRateLimitWindowMinutes * 60 * 1000);
  const [linha] = await ctx.db
    .select({ n: count() })
    .from(codigoOtp)
    .where(and(eq(codigoOtp.email, email.toLowerCase()), gt(codigoOtp.criadoEm, desde)));
  return linha?.n ?? 0;
}

/**
 * Cria e persiste um código OTP.
 * @returns Código de 6 dígitos (uso interno — enviar por email, não retornar ao cliente).
 */
export async function criarOtp(ctx: DbContext, email: string, finalidade: string): Promise<string> {
  const codigo = gerarCodigoOtp();
  const expiraEm = new Date(Date.now() + mvpDefaults.auth.otpExpiresMinutes * 60 * 1000);
  await ctx.db.insert(codigoOtp).values(
    comCriadoEm({
      email: email.toLowerCase(),
      codigo,
      finalidade,
      expiraEm,
    }),
  );
  return codigo;
}

/**
 * Valida OTP e marca como usado.
 * @returns `true` se válido; `false` se expirado, já usado ou inexistente.
 */
export async function verificarOtp(
  ctx: DbContext,
  email: string,
  finalidade: string,
  codigo: string,
): Promise<boolean> {
  const agora = new Date();
  const linha = await ctx.db.query.codigoOtp.findFirst({
    where: and(
      eq(codigoOtp.email, email.toLowerCase()),
      eq(codigoOtp.finalidade, finalidade),
      eq(codigoOtp.codigo, codigo),
      gt(codigoOtp.expiraEm, agora),
      isNull(codigoOtp.usadoEm),
    ),
    columns: colunasCodigoOtpVerificacao,
  });

  if (!linha) return false;

  await ctx.db.update(codigoOtp).set({ usadoEm: agora }).where(eq(codigoOtp.id, linha.id));

  return true;
}

/** Gera slug URL-safe a partir de nome de organização. */
export function slugify(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 48);
}
