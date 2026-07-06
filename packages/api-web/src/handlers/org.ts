import { forbidden, notFound } from "@whasap/api-core";
import { sendInviteEmail, verifyOtp, verifyTurnstile } from "@whasap/api-core";
import { appCreateData, resolveInternalId } from "@whasap/db";

import { toOrganizacaoOutput } from "../lib/mappers";
import { mvpDefaults } from "../lib/asaas";
import type { WebContext } from "../types";
import {
  requireAdmin,
  requireAdminInternal,
  requireAuth,
  requireOrg,
  requireOrgInternal,
} from "./auth";
import { persistSessionOrganization } from "../lib/session";

export const organizacaoHandlers = {
  lista: async (ctx: WebContext) => {
    const current = requireAuth(ctx);
    const rows = await ctx.client.organizationMembers.findMany({
      where: { usuarioId: current.internalId },
      include: { organization: true },
    });
    return rows.map((r) => toOrganizacaoOutput(r.organization!));
  },

  obter: async (ctx: WebContext, input: { organizacaoId: string }) => {
    await requireOrg(ctx, input.organizacaoId);
    const org = await ctx.client.organizations.findFirst({
      where: { uuid: input.organizacaoId },
    });
    if (!org) notFound();
    return toOrganizacaoOutput(org);
  },

  atualizar: async (
    ctx: WebContext,
    input: {
      organizacaoId: string;
      nome?: string;
      documento?: string;
      tipoDocumento?: "cpf" | "cnpj";
      razaoSocial?: string;
    },
  ) => {
    await requireAdmin(ctx, input.organizacaoId);
    const org = await ctx.client.organizations.update({
      where: { uuid: input.organizacaoId },
      data: {
        name: input.nome,
        taxId: input.documento,
        taxIdType: input.tipoDocumento,
        legalName: input.razaoSocial,
      },
    });
    if (!org) notFound();
    return toOrganizacaoOutput(org);
  },

  trocar: async (ctx: WebContext, input: { organizacaoId: string }) => {
    const current = requireAuth(ctx);
    const internalOrgId = await resolveInternalId(
      ctx.client,
      "organizations",
      input.organizacaoId,
    );
    if (internalOrgId === null) notFound();

    const membership = await ctx.client.organizationMembers.findFirst({
      where: {
        usuarioId: current.internalId,
        organizationId: internalOrgId,
      },
    });
    if (!membership) forbidden();
    ctx.organizationId = internalOrgId;
    ctx.role = membership.role;

    if (ctx.sessionToken) {
      await persistSessionOrganization(ctx, ctx.sessionToken, internalOrgId);
    }

    return { ok: true };
  },

  membros: {
    lista: async (ctx: WebContext, input: { organizacaoId: string }) => {
      const internalOrgId = await resolveInternalId(
        ctx.client,
        "organizations",
        input.organizacaoId,
      );
      if (internalOrgId === null) notFound();
      requireOrgInternal(ctx, internalOrgId);

      const rows = await ctx.client.organizationMembers.findMany({
        where: { organizationId: internalOrgId },
        include: { organization: true, usuario: true },
      });

      return rows
        .filter((r) => r.organization && r.usuario)
        .map((r) => ({
          id: r.uuid,
          organizacaoId: r.organization!.uuid,
          usuarioId: r.usuario!.uuid,
          usuarioNome: r.usuario!.nome,
          usuarioEmail: r.usuario!.email,
          role: r.role,
        }));
    },

    convidar: async (
      ctx: WebContext,
      input: {
        organizacaoId: string;
        email: string;
        nome?: string;
        role: "admin" | "usuario" | "analista";
      },
    ) => {
      const internalOrgId = await resolveInternalId(
        ctx.client,
        "organizations",
        input.organizacaoId,
      );
      if (internalOrgId === null) notFound();
      requireAdminInternal(ctx, internalOrgId);

      const org = await ctx.client.organizations.findFirst({
        where: { id: internalOrgId },
      });
      if (!org) notFound();

      const token = crypto.randomUUID();
      const expiresAt = new Date(
        Date.now() + mvpDefaults.team.inviteExpiresDays * 24 * 60 * 60 * 1000,
      );
      const invite = await ctx.client.organizationInvites.create({
        data: appCreateData({
          organizationId: internalOrgId,
          email: input.email.toLowerCase(),
          name: input.nome,
          role: input.role,
          token,
          expiresAt,
          createdByUsuarioId: ctx.usuario!.internalId,
        }),
      });
      const urlConvite = `${ctx.env.WEB_URL}/convite/${token}`;
      await sendInviteEmail(ctx.env, input.email, org.name, urlConvite);
      return { conviteId: invite.uuid, urlConvite };
    },

    atualizarPapel: async (
      ctx: WebContext,
      input: { membroId: string; role: "admin" | "usuario" | "analista" },
    ) => {
      requireAuth(ctx);
      const member = await ctx.client.organizationMembers.findFirst({
        where: { uuid: input.membroId },
      });
      if (!member) notFound();
      requireAdminInternal(ctx, member.organizationId);

      await ctx.client.organizationMembers.update({
        where: { id: member.id },
        data: { role: input.role },
      });
      return { ok: true };
    },

    desativar: async (ctx: WebContext, input: { membroId: string }) => {
      requireAuth(ctx);
      const member = await ctx.client.organizationMembers.findFirst({
        where: { uuid: input.membroId },
      });
      if (!member) notFound();
      requireAdminInternal(ctx, member.organizationId);
      if (member.usuarioId === ctx.usuario!.internalId) forbidden("Não é possível remover a si mesmo");

      await ctx.client.organizationMembers.delete({ where: { id: member.id } });
      return { ok: true };
    },
  },

  convites: {
    lista: async (ctx: WebContext, input: { organizacaoId: string }) => {
      const internalOrgId = await resolveInternalId(
        ctx.client,
        "organizations",
        input.organizacaoId,
      );
      if (internalOrgId === null) notFound();
      requireAdminInternal(ctx, internalOrgId);

      const rows = await ctx.client.organizationInvites.findMany({
        where: { organizationId: internalOrgId },
      });

      return rows.map((r) => ({
        id: r.uuid,
        email: r.email,
        nome: r.name,
        role: r.role,
        expiraEm: r.expiresAt.toISOString(),
        aceitoEm: r.acceptedAt?.toISOString() ?? null,
      }));
    },

    aceitar: async (
      ctx: WebContext,
      input: { token: string; otp: string; turnstileToken: string },
    ) => {
      await verifyTurnstile(ctx.env, input.turnstileToken, ctx.clientIp);

      const invite = await ctx.client.organizationInvites.findFirst({
        where: { token: input.token },
        include: { organization: true },
      });
      if (!invite?.organization) notFound();
      if (invite.acceptedAt) forbidden("Convite já aceito");
      if (invite.expiresAt < new Date()) forbidden("Convite expirado");

      const email = invite.email.toLowerCase();
      const valid = await verifyOtp(ctx, email, "invite", input.otp);
      if (!valid) forbidden("Código inválido ou expirado");

      let user = await ctx.client.usuario.findFirst({ where: { email } });
      if (!user) {
        user = await ctx.client.usuario.create({
          data: appCreateData({
            email,
            nome: invite.name ?? email.split("@")[0] ?? email,
            emailVerificadoEm: new Date(),
          }),
        });
      }

      const existing = await ctx.client.organizationMembers.findFirst({
        where: { organizationId: invite.organizationId, usuarioId: user.id },
      });
      if (!existing) {
        await ctx.client.organizationMembers.create({
          data: appCreateData({
            organizationId: invite.organizationId,
            usuarioId: user.id,
            role: invite.role,
            invitedAt: invite.criadoEm,
            joinedAt: new Date(),
          }),
        });
      }

      await ctx.client.organizationInvites.update({
        where: { id: invite.id },
        data: { acceptedAt: new Date() },
      });

      return { ok: true, organizacaoId: invite.organization.uuid };
    },
  },
};
