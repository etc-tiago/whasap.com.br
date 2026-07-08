import { and, eq, gt, isNull } from "drizzle-orm";
import { mvpDefaults } from "@whasap/config";
import { createSessionCookieHelpers } from "@whasap/api-core";
import {
  colunasMembroOrganizacao,
  colunasSessaoWeb,
  colunasUsuarioSessao,
  comCriadoEm,
  incluirOrganizacaoPublica,
  organizacaoMembro,
  sessao,
  usuario,
} from "@whasap/db";

import type { WebContext, WebUsuario, MemberRole } from "../types";

export const SESSION_COOKIE = "whasap_web";
export const SESSION_MAX_AGE_SECONDS = mvpDefaults.auth.sessionMaxAgeDays * 24 * 60 * 60;

const cookieHelpers = createSessionCookieHelpers(SESSION_COOKIE);

export const getSessionTokenFromRequest = cookieHelpers.getSessionTokenFromRequest;
export const sessionCookieHeader = cookieHelpers.sessionCookieHeader;
export const clearSessionCookieHeader = cookieHelpers.clearSessionCookieHeader;

/** Cria sessão web e retorna token opaco + expiração. */
export async function createSession(
  ctx: WebContext,
  usuarioInternalId: number,
  organizationId?: number,
): Promise<{ token: string; expiraEm: Date }> {
  const token = crypto.randomUUID();
  const expiraEm = new Date(Date.now() + SESSION_MAX_AGE_SECONDS * 1000);
  await ctx.db.insert(sessao).values(
    comCriadoEm({
      usuarioId: usuarioInternalId,
      organizacaoId: organizationId ?? null,
      token,
      expiraEm,
    }),
  );
  return { token, expiraEm };
}

/** Atualiza organização ativa na sessão. */
export async function persistSessionOrganization(
  ctx: WebContext,
  token: string,
  organizationId: number,
): Promise<void> {
  await ctx.db.update(sessao).set({ organizacaoId: organizationId }).where(eq(sessao.token, token));
}

/** Remove sessão pelo token. */
export async function deleteSession(ctx: WebContext, token: string): Promise<void> {
  await ctx.db.delete(sessao).where(eq(sessao.token, token));
}

/**
 * Resolve sessão a partir do token do cookie.
 * @returns Usuário autenticado ou null; `organizationId` e `role` sempre null aqui.
 */
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
  const session = await ctx.db.query.sessao.findFirst({
    where: and(eq(sessao.token, token), gt(sessao.expiraEm, now)),
    columns: colunasSessaoWeb,
  });

  if (!session) return { usuario: null, organizationId: null, role: null };

  const row = await ctx.db.query.usuario.findFirst({
    where: and(eq(usuario.id, session.usuarioId), isNull(usuario.excluidoEm)),
    columns: colunasUsuarioSessao,
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

/**
 * Busca organização e papel do usuário (primeira ou org específica da sessão).
 * @returns Organização ativa + papel ou null.
 */
export async function getOrganizationForUser(
  ctx: WebContext,
  usuarioInternalId: number,
  organizationId?: number,
) {
  const membership = await ctx.db.query.organizacaoMembro.findFirst({
    where: and(
      eq(organizacaoMembro.usuarioId, usuarioInternalId),
      ...(organizationId !== undefined
        ? [eq(organizacaoMembro.organizacaoId, organizationId)]
        : []),
      isNull(organizacaoMembro.excluidoEm),
    ),
    columns: colunasMembroOrganizacao,
    with: { organizacao: incluirOrganizacaoPublica },
  });

  if (!membership?.organizacao) return null;

  return {
    organization: membership.organizacao,
    role: membership.papel,
  };
}
