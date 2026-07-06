import { mvpDefaults } from "@whasap/config";
import { appCreateData } from "@whasap/db";

import type { DbContext } from "../types";

function generateOtpCode(): string {
  const n = crypto.getRandomValues(new Uint32Array(1))[0]! % 1_000_000;
  return n.toString().padStart(6, "0");
}

export async function countRecentOtps(ctx: DbContext, email: string): Promise<number> {
  const since = new Date(
    Date.now() - mvpDefaults.auth.otpRateLimitWindowMinutes * 60 * 1000,
  );
  return ctx.client.codigoOtp.count({
    where: {
      email: email.toLowerCase(),
      criadoEm: { gt: since },
    },
  });
}

export async function createOtp(
  ctx: DbContext,
  email: string,
  purpose: string,
): Promise<string> {
  const code = generateOtpCode();
  const expiraEm = new Date(Date.now() + mvpDefaults.auth.otpExpiresMinutes * 60 * 1000);
  await ctx.client.codigoOtp.create({
    data: appCreateData({
      email: email.toLowerCase(),
      codigo: code,
      finalidade: purpose,
      expiraEm,
    }),
  });
  return code;
}

export async function verifyOtp(
  ctx: DbContext,
  email: string,
  purpose: string,
  code: string,
): Promise<boolean> {
  const now = new Date();
  const row = await ctx.client.codigoOtp.findFirst({
    where: {
      email: email.toLowerCase(),
      finalidade: purpose,
      codigo: code,
      expiraEm: { gt: now },
      usadoEm: null,
    },
  });

  if (!row) return false;

  await ctx.client.codigoOtp.update({
    where: { id: row.id },
    data: { usadoEm: now },
  });

  return true;
}

export function slugify(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 48);
}
