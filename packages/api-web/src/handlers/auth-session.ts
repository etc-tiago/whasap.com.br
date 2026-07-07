import { forbidden, unauthorized } from "@whasap/api-core";
import { resolveInternalId, type organizacao as OrganizacaoTable } from "@whasap/db";

import { toOrganizacaoOutput } from "../lib/mappers";
import type { MemberRole, WebContext } from "../types";

export type ResolvedMembership = {
  internalOrgId: number;
  role: MemberRole;
};

export function requireAuth(ctx: WebContext) {
  if (!ctx.usuario) {
    unauthorized("Não autenticado");
  }
  return ctx.usuario;
}

export async function resolveMembership(
  ctx: WebContext,
  organizacaoHash: string,
): Promise<ResolvedMembership> {
  const usuario = requireAuth(ctx);
  const internalOrgId = await resolveInternalId(ctx.client, "organizacao", organizacaoHash);
  if (internalOrgId === null) {
    forbidden("Sem acesso à organização");
  }

  const membership = await ctx.client.organizacaoMembro.findFirst({
    where: {
      usuarioId: usuario.internalId,
      organizacaoId: internalOrgId,
    },
  });

  if (!membership) {
    forbidden("Sem acesso à organização");
  }

  return { internalOrgId, role: membership.papel as MemberRole };
}

export async function resolveMembershipInternal(
  ctx: WebContext,
  organizationId: number,
): Promise<ResolvedMembership> {
  const usuario = requireAuth(ctx);

  const membership = await ctx.client.organizacaoMembro.findFirst({
    where: {
      usuarioId: usuario.internalId,
      organizacaoId: organizationId,
    },
  });

  if (!membership) {
    forbidden("Sem acesso à organização");
  }

  return { internalOrgId: organizationId, role: membership.papel as MemberRole };
}

export async function requireOrg(ctx: WebContext, organizacaoHash: string) {
  await resolveMembership(ctx, organizacaoHash);
  return requireAuth(ctx);
}

export async function requireOrgInternal(ctx: WebContext, organizationId: number) {
  await resolveMembershipInternal(ctx, organizationId);
  return requireAuth(ctx);
}

export async function requireAdmin(ctx: WebContext, organizacaoHash: string) {
  const { role } = await resolveMembership(ctx, organizacaoHash);
  if (role !== "admin") {
    forbidden("Apenas administradores");
  }
  return requireAuth(ctx);
}

export async function requireAdminInternal(ctx: WebContext, organizationId: number) {
  const { role } = await resolveMembershipInternal(ctx, organizationId);
  if (role !== "admin") {
    forbidden("Apenas administradores");
  }
  return requireAuth(ctx);
}

export function toSessionOutput(
  ctx: WebContext,
  org: typeof OrganizacaoTable.$inferSelect | null,
) {
  if (!ctx.usuario) {
    unauthorized();
  }
  return {
    usuario: {
      id: ctx.usuario.id,
      email: ctx.usuario.email,
      nome: ctx.usuario.nome,
      emailVerificadoEm: ctx.usuario.emailVerificadoEm?.toISOString() ?? null,
    },
    organizacao: org ? toOrganizacaoOutput(org) : null,
    role: ctx.role as MemberRole | null,
  };
}
