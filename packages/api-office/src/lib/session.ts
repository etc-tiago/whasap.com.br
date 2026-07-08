import { createSessionCookieHelpers } from "@whasap/api-core";
import { mvpDefaults } from "@whasap/config";
import {
  colunasOfficeUsuarioSessao,
  colunasSessaoOffice,
  comCriadoEm,
  officeSessao,
  officeUsuario,
} from "@whasap/db";
import { and, eq, gt, isNull } from "drizzle-orm";

import type { OfficeContext, OfficeUsuario } from "../types";

export const SESSION_COOKIE = "whasap_office";
export const SESSION_MAX_AGE_SECONDS = mvpDefaults.office.sessionMaxAgeDays * 24 * 60 * 60;

const cookieHelpers = createSessionCookieHelpers(SESSION_COOKIE);

export const getSessionTokenFromRequest = cookieHelpers.getSessionTokenFromRequest;
export const sessionCookieHeader = cookieHelpers.sessionCookieHeader;
export const clearSessionCookieHeader = cookieHelpers.clearSessionCookieHeader;

/** Cria sessão office e retorna token opaco + expiração. */
export async function createSession(
  ctx: OfficeContext,
  officeUsuarioInternalId: number,
): Promise<{ token: string; expiraEm: Date }> {
  const token = crypto.randomUUID();
  const expiraEm = new Date(Date.now() + SESSION_MAX_AGE_SECONDS * 1000);
  await ctx.db
    .insert(officeSessao)
    .values(comCriadoEm({ officeUsuarioId: officeUsuarioInternalId, token, expiraEm }));
  return { token, expiraEm };
}

/** Remove sessão office pelo token. */
export async function deleteSession(ctx: OfficeContext, token: string): Promise<void> {
  await ctx.db.delete(officeSessao).where(eq(officeSessao.token, token));
}

/**
 * Resolve sessão office a partir do token.
 * @returns Usuário office autenticado ou null.
 */
export async function resolveSession(
  ctx: OfficeContext,
  token: string | null,
): Promise<{ officeUsuario: OfficeUsuario | null }> {
  if (!token) return { officeUsuario: null };

  const now = new Date();
  const session = await ctx.db.query.officeSessao.findFirst({
    where: and(eq(officeSessao.token, token), gt(officeSessao.expiraEm, now)),
    columns: colunasSessaoOffice,
  });

  if (!session) return { officeUsuario: null };

  const row = await ctx.db.query.officeUsuario.findFirst({
    where: and(eq(officeUsuario.id, session.officeUsuarioId), isNull(officeUsuario.excluidoEm)),
    columns: colunasOfficeUsuarioSessao,
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
