import { mvpDefaults } from "@whasap/config";
import { createSessionCookieHelpers } from "@whasap/api-core";
import { appCreateData } from "@whasap/db";

import type { OfficeContext, OfficeUsuario } from "../types";

export const SESSION_COOKIE = "whasap_office";
export const SESSION_MAX_AGE_SECONDS = mvpDefaults.office.sessionMaxAgeDays * 24 * 60 * 60;

const cookieHelpers = createSessionCookieHelpers(SESSION_COOKIE);

export const getSessionTokenFromRequest = cookieHelpers.getSessionTokenFromRequest;
export const sessionCookieHeader = cookieHelpers.sessionCookieHeader;
export const clearSessionCookieHeader = cookieHelpers.clearSessionCookieHeader;

export async function createSession(
  ctx: OfficeContext,
  officeUsuarioInternalId: number,
): Promise<string> {
  const token = crypto.randomUUID();
  const expiraEm = new Date(Date.now() + SESSION_MAX_AGE_SECONDS * 1000);
  await ctx.client.officeSessao.create({
    data: appCreateData({ officeUsuarioId: officeUsuarioInternalId, token, expiraEm }),
  });
  return token;
}

export async function deleteSession(ctx: OfficeContext, token: string): Promise<void> {
  await ctx.client.officeSessao.delete({ where: { token } });
}

export async function resolveSession(
  ctx: OfficeContext,
  token: string | null,
): Promise<{ officeUsuario: OfficeUsuario | null }> {
  if (!token) return { officeUsuario: null };

  const now = new Date();
  const session = await ctx.client.officeSessao.findFirst({
    where: { token, expiraEm: { gt: now } },
  });

  if (!session) return { officeUsuario: null };

  const row = await ctx.client.officeUsuario.findFirst({
    where: { id: session.officeUsuarioId },
  });

  if (!row) return { officeUsuario: null };

  return {
    officeUsuario: {
      id: row.uuid,
      internalId: row.id,
      email: row.email,
      nome: row.nome,
    },
  };
}
