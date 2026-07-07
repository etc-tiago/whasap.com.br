import { and, eq, isNull } from "drizzle-orm";
import { forbidden, unauthorized } from "@whasap/api-core";
import { colunasMembroPapel, organizacao, organizacaoMembro, resolverIdInterno } from "@whasap/db";

import { toOrganizacaoOutput } from "../lib/mappers";
import type { MemberRole, WebContext } from "../types";

export type MembroResolvido = {
  internalOrgId: number;
  role: MemberRole;
};

/** @deprecated Use `MembroResolvido` */
export type ResolvedMembership = MembroResolvido;

/**
 * Garante que a requisição tem sessão web válida.
 * @throws 401 se `ctx.usuario` estiver ausente.
 */
export function exigirAutenticacao(ctx: WebContext) {
  if (!ctx.usuario) {
    unauthorized("Não autenticado");
  }
  return ctx.usuario;
}

/**
 * Resolve vínculo do usuário com a organização pelo uuid público.
 * @throws 403 se a org não existir ou o usuário não for membro.
 */
export async function resolverMembro(
  ctx: WebContext,
  organizacaoHash: string,
): Promise<MembroResolvido> {
  const usuario = exigirAutenticacao(ctx);
  const internalOrgId = await resolverIdInterno(ctx.db, "organizacao", organizacaoHash);
  if (internalOrgId === null) {
    forbidden("Sem acesso à organização");
  }

  const membership = await ctx.db.query.organizacaoMembro.findFirst({
    where: and(
      eq(organizacaoMembro.usuarioId, usuario.internalId),
      eq(organizacaoMembro.organizacaoId, internalOrgId),
      isNull(organizacaoMembro.excluidoEm),
    ),
    columns: colunasMembroPapel,
  });

  if (!membership) {
    forbidden("Sem acesso à organização");
  }

  return { internalOrgId, role: membership.papel as MemberRole };
}

/**
 * Resolve vínculo do usuário com a organização pelo id interno (PK).
 * @throws 403 se o usuário não for membro.
 */
export async function resolverMembroPorIdInterno(
  ctx: WebContext,
  organizationId: number,
): Promise<MembroResolvido> {
  const usuario = exigirAutenticacao(ctx);

  const membership = await ctx.db.query.organizacaoMembro.findFirst({
    where: and(
      eq(organizacaoMembro.usuarioId, usuario.internalId),
      eq(organizacaoMembro.organizacaoId, organizationId),
      isNull(organizacaoMembro.excluidoEm),
    ),
    columns: colunasMembroPapel,
  });

  if (!membership) {
    forbidden("Sem acesso à organização");
  }

  return { internalOrgId: organizationId, role: membership.papel as MemberRole };
}

/**
 * Exige autenticação e membro da organização (por uuid público).
 */
export async function exigirOrganizacao(ctx: WebContext, organizacaoHash: string) {
  await resolverMembro(ctx, organizacaoHash);
  return exigirAutenticacao(ctx);
}

/**
 * Exige autenticação e membro da organização (por id interno).
 */
export async function exigirOrganizacaoPorIdInterno(ctx: WebContext, organizationId: number) {
  await resolverMembroPorIdInterno(ctx, organizationId);
  return exigirAutenticacao(ctx);
}

/**
 * Exige papel `admin` na organização (por uuid público).
 * @throws 403 se o usuário não for administrador.
 */
export async function exigirAdmin(ctx: WebContext, organizacaoHash: string) {
  const { role } = await resolverMembro(ctx, organizacaoHash);
  if (role !== "admin") {
    forbidden("Apenas administradores");
  }
  return exigirAutenticacao(ctx);
}

/**
 * Exige papel `admin` na organização (por id interno).
 * @throws 403 se o usuário não for administrador.
 */
export async function exigirAdminPorIdInterno(ctx: WebContext, organizationId: number) {
  const { role } = await resolverMembroPorIdInterno(ctx, organizationId);
  if (role !== "admin") {
    forbidden("Apenas administradores");
  }
  return exigirAutenticacao(ctx);
}

/**
 * Monta resposta de sessão web para `autenticacao.eu` e login.
 * Inclui organização ativa e papel do membro quando disponíveis.
 */
export function mapearSessaoParaSaida(
  ctx: WebContext,
  org: Pick<
    typeof organizacao.$inferSelect,
    | "uuid"
    | "nome"
    | "slug"
    | "documentoFiscal"
    | "tipoDocumento"
    | "razaoSocial"
    | "asaasIdCliente"
  > | null,
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

/** @deprecated Use `exigirAutenticacao` */
export const requireAuth = exigirAutenticacao;
/** @deprecated Use `resolverMembro` */
export const resolveMembership = resolverMembro;
/** @deprecated Use `resolverMembroPorIdInterno` */
export const resolveMembershipInternal = resolverMembroPorIdInterno;
/** @deprecated Use `exigirOrganizacao` */
export const requireOrg = exigirOrganizacao;
/** @deprecated Use `exigirOrganizacaoPorIdInterno` */
export const requireOrgInternal = exigirOrganizacaoPorIdInterno;
/** @deprecated Use `exigirAdmin` */
export const requireAdmin = exigirAdmin;
/** @deprecated Use `exigirAdminPorIdInterno` */
export const requireAdminInternal = exigirAdminPorIdInterno;
/** @deprecated Use `mapearSessaoParaSaida` */
export const toSessionOutput = mapearSessaoParaSaida;
