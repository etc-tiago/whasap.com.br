import { mvpDefaults } from "@whasap/config";
import { createSessionCookieHelpers } from "@whasap/api-core";
import { appCreateData } from "@whasap/db";

import type { WebContext, WebUsuario, MemberRole } from "../types";

export const SESSION_COOKIE = "whasap_web";
export const SESSION_MAX_AGE_SECONDS = mvpDefaults.auth.sessionMaxAgeDays * 24 * 60 * 60;

const cookieHelpers = createSessionCookieHelpers(SESSION_COOKIE);

export const getSessionTokenFromRequest = cookieHelpers.getSessionTokenFromRequest;
export const sessionCookieHeader = cookieHelpers.sessionCookieHeader;
export const clearSessionCookieHeader = cookieHelpers.clearSessionCookieHeader;

export async function createSession(
  ctx: WebContext,
  usuarioInternalId: number,
  organizationId?: number,
): Promise<string> {
  const token = crypto.randomUUID();
  const expiraEm = new Date(Date.now() + SESSION_MAX_AGE_SECONDS * 1000);
  await ctx.client.sessao.create({
    data: appCreateData({
      usuarioId: usuarioInternalId,
      organizacaoId: organizationId ?? null,
      token,
      expiraEm,
    }),
  });
  return token;
}

export async function persistSessionOrganization(
  ctx: WebContext,
  token: string,
  organizationId: number,
): Promise<void> {
  await ctx.client.sessao.update({
    where: { token },
    data: { organizacaoId: organizationId },
  });
}

export async function deleteSession(ctx: WebContext, token: string): Promise<void> {
  await ctx.client.sessao.delete({ where: { token } });
}

export async function resolveSession(
  ctx: WebContext,
  token: string | null,
): Promise<{
  usuario: WebUsuario | null;
  organizationId: number | null;
  role: MemberRole | null;
}> {
  if (!token) return { usuario: null, organizationId: null, role: null };

  const now = new Date();
  const session = await ctx.client.sessao.findFirst({
    where: { token, expiraEm: { gt: now } },
  });

  if (!session) return { usuario: null, organizationId: null, role: null };

  const row = await ctx.client.usuario.findFirst({
    where: { id: session.usuarioId },
  });

  if (!row) return { usuario: null, organizationId: null, role: null };

  return {
    usuario: {
      id: row.uuid,
      internalId: row.id,
      email: row.email,
      nome: row.nome,
      emailVerificadoEm: row.emailVerificadoEm,
    },
    organizationId: null,
    role: null,
  };
}

export async function getOrganizationForUser(
  ctx: WebContext,
  usuarioInternalId: number,
  organizationId?: number,
) {
  const membership = await ctx.client.organizacaoMembro.findFirst({
    where: {
      usuarioId: usuarioInternalId,
      ...(organizationId !== undefined ? { organizacaoId: organizationId } : {}),
    },
    include: { organizacao: true },
  });

  if (!membership?.organizacao) return null;

  return {
    organization: membership.organizacao,
    role: membership.papel,
  };
}
