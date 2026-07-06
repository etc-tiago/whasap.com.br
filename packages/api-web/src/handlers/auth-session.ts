import { forbidden, unauthorized } from "@whasap/api-core";
import { resolveInternalId, type organizations as OrganizationsTable } from "@whasap/db";

import { toOrganizacaoOutput } from "../lib/mappers";
import type { MemberRole, WebContext } from "../types";

export function requireAuth(ctx: WebContext) {
  if (!ctx.usuario) {
    unauthorized("Não autenticado");
  }
  return ctx.usuario;
}

export async function requireOrg(ctx: WebContext, organizacaoUuid: string) {
  const usuario = requireAuth(ctx);
  const internalId = await resolveInternalId(ctx.client, "organizations", organizacaoUuid);
  if (internalId === null || ctx.organizationId !== internalId || !ctx.role) {
    forbidden("Sem acesso à organização");
  }
  return usuario;
}

export function requireOrgInternal(ctx: WebContext, organizationId: number) {
  const usuario = requireAuth(ctx);
  if (ctx.organizationId !== organizationId || !ctx.role) {
    forbidden("Sem acesso à organização");
  }
  return usuario;
}

export async function requireAdmin(ctx: WebContext, organizacaoUuid: string) {
  await requireOrg(ctx, organizacaoUuid);
  if (ctx.role !== "admin") {
    forbidden("Apenas administradores");
  }
}

export function requireAdminInternal(ctx: WebContext, organizationId: number) {
  requireOrgInternal(ctx, organizationId);
  if (ctx.role !== "admin") {
    forbidden("Apenas administradores");
  }
}

export function toSessionOutput(
  ctx: WebContext,
  org: typeof OrganizationsTable.$inferSelect | null,
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
