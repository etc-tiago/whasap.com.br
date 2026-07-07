import { forbidden, notFound } from "@whasap/api-core";
import { sendInviteEmail, slugify, verifyOtp } from "@whasap/api-core";
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
  resolveMembership,
} from "./auth";
import { persistSessionOrganization } from "../lib/session";

export const organizacaoHandlers = {
  lista: async (ctx: WebContext) => {
    const current = requireAuth(ctx);
    const rows = await ctx.client.organizacaoMembro.findMany({
      where: { usuarioId: current.internalId },
      include: { organizacao: true },
    });
    return rows
      .filter((r) => r.organizacao)
      .sort((a, b) => a.ingressouEm.getTime() - b.ingressouEm.getTime())
      .map((r) => toOrganizacaoOutput(r.organizacao!));
  },

  criar: async (ctx: WebContext, input: { nome: string }) => {
    const current = requireAuth(ctx);
    const now = new Date();

    let slug = slugify(input.nome);
    const slugConflict = await ctx.client.organizacao.findFirst({
      where: { slug },
      select: { id: true },
    });
    if (slugConflict) slug = `${slug}-${crypto.randomUUID().slice(0, 8)}`;

    const org = await ctx.client.organizacao.create({
      data: appCreateData({
        nome: input.nome,
        slug,
      }),
    });

    await ctx.client.organizacaoMembro.create({
      data: appCreateData({
        organizacaoId: org.id,
        usuarioId: current.internalId,
        papel: "admin",
        ingressouEm: now,
      }),
    });

    return toOrganizacaoOutput(org);
  },

  obter: async (ctx: WebContext, input: { organizacaoHash: string }) => {
    const { role } = await resolveMembership(ctx, input.organizacaoHash);
    const org = await ctx.client.organizacao.findFirst({
      where: { uuid: input.organizacaoHash },
    });
    if (!org) notFound();
    return { ...toOrganizacaoOutput(org), meuPapel: role };
  },

  atualizar: async (
    ctx: WebContext,
    input: {
      organizacaoHash: string;
      nome?: string;
      documento?: string;
      tipoDocumento?: "cpf" | "cnpj";
      razaoSocial?: string;
    },
  ) => {
    await requireAdmin(ctx, input.organizacaoHash);
    const org = await ctx.client.organizacao.update({
      where: { uuid: input.organizacaoHash },
      data: {
        nome: input.nome,
        documentoFiscal: input.documento,
        tipoDocumento: input.tipoDocumento,
        razaoSocial: input.razaoSocial,
      },
    });
    if (!org) notFound();
    return toOrganizacaoOutput(org);
  },

  trocar: async (ctx: WebContext, input: { organizacaoHash: string }) => {
    const current = requireAuth(ctx);
    const internalOrgId = await resolveInternalId(
      ctx.client,
      "organizacao",
      input.organizacaoHash,
    );
    if (internalOrgId === null) notFound();

    const membership = await ctx.client.organizacaoMembro.findFirst({
      where: {
        usuarioId: current.internalId,
        organizacaoId: internalOrgId,
      },
    });
    if (!membership) forbidden();
    ctx.organizationId = internalOrgId;
    ctx.role = membership.papel;

    if (ctx.sessionToken) {
      await persistSessionOrganization(ctx, ctx.sessionToken, internalOrgId);
    }

    return { ok: true };
  },

  membros: {
    lista: async (ctx: WebContext, input: { organizacaoHash: string }) => {
      const internalOrgId = await resolveInternalId(
        ctx.client,
        "organizacao",
        input.organizacaoHash,
      );
      if (internalOrgId === null) notFound();
      await requireOrgInternal(ctx, internalOrgId);

      const rows = await ctx.client.organizacaoMembro.findMany({
        where: { organizacaoId: internalOrgId },
        include: { organizacao: true, usuario: true },
      });

      return rows
        .filter((r) => r.organizacao && r.usuario)
        .map((r) => ({
          id: r.uuid,
          organizacaoId: r.organizacao!.uuid,
          usuarioId: r.usuario!.uuid,
          usuarioNome: r.usuario!.nome,
          usuarioEmail: r.usuario!.email,
          role: r.papel,
        }));
    },

    convidar: async (
      ctx: WebContext,
      input: {
        organizacaoHash: string;
        email: string;
        nome?: string;
        role: "admin" | "usuario" | "analista";
      },
    ) => {
      const internalOrgId = await resolveInternalId(
        ctx.client,
        "organizacao",
        input.organizacaoHash,
      );
      if (internalOrgId === null) notFound();
      await requireAdminInternal(ctx, internalOrgId);

      const org = await ctx.client.organizacao.findFirst({
        where: { id: internalOrgId },
      });
      if (!org) notFound();

      const token = crypto.randomUUID();
      const expiraEm = new Date(
        Date.now() + mvpDefaults.team.inviteExpiresDays * 24 * 60 * 60 * 1000,
      );
      const invite = await ctx.client.organizacaoConvite.create({
        data: appCreateData({
          organizacaoId: internalOrgId,
          email: input.email.toLowerCase(),
          nome: input.nome,
          papel: input.role,
          token,
          expiraEm,
          criadoPorUsuarioId: ctx.usuario!.internalId,
        }),
      });
      const urlConvite = `${ctx.env.WEB_URL}/convite/${token}`;
      await sendInviteEmail(ctx.env, input.email, org.nome, urlConvite);
      return { conviteId: invite.uuid, urlConvite };
    },

    atualizarPapel: async (
      ctx: WebContext,
      input: { membroId: string; role: "admin" | "usuario" | "analista" },
    ) => {
      requireAuth(ctx);
      const member = await ctx.client.organizacaoMembro.findFirst({
        where: { uuid: input.membroId },
      });
      if (!member) notFound();
      await requireAdminInternal(ctx, member.organizacaoId);

      await ctx.client.organizacaoMembro.update({
        where: { id: member.id },
        data: { papel: input.role },
      });
      return { ok: true };
    },

    desativar: async (ctx: WebContext, input: { membroId: string }) => {
      requireAuth(ctx);
      const member = await ctx.client.organizacaoMembro.findFirst({
        where: { uuid: input.membroId },
      });
      if (!member) notFound();
      await requireAdminInternal(ctx, member.organizacaoId);
      if (member.usuarioId === ctx.usuario!.internalId) forbidden("Não é possível remover a si mesmo");

      await ctx.client.organizacaoMembro.delete({ where: { id: member.id } });
      return { ok: true };
    },
  },

  convites: {
    lista: async (ctx: WebContext, input: { organizacaoHash: string }) => {
      const internalOrgId = await resolveInternalId(
        ctx.client,
        "organizacao",
        input.organizacaoHash,
      );
      if (internalOrgId === null) notFound();
      await requireAdminInternal(ctx, internalOrgId);

      const rows = await ctx.client.organizacaoConvite.findMany({
        where: { organizacaoId: internalOrgId },
      });

      return rows.map((r) => ({
        id: r.uuid,
        email: r.email,
        nome: r.nome,
        role: r.papel,
        expiraEm: r.expiraEm.toISOString(),
        aceitoEm: r.aceitoEm?.toISOString() ?? null,
      }));
    },

    aceitar: async (
      ctx: WebContext,
      input: { token: string; otp: string },
    ) => {
      const invite = await ctx.client.organizacaoConvite.findFirst({
        where: { token: input.token },
        include: { organizacao: true },
      });
      if (!invite?.organizacao) notFound();
      if (invite.aceitoEm) forbidden("Convite já aceito");
      if (invite.expiraEm < new Date()) forbidden("Convite expirado");

      const email = invite.email.toLowerCase();
      const valid = await verifyOtp(ctx, email, "invite", input.otp);
      if (!valid) forbidden("Código inválido ou expirado");

      let user = await ctx.client.usuario.findFirst({ where: { email } });
      if (!user) {
        user = await ctx.client.usuario.create({
          data: appCreateData({
            email,
            nome: invite.nome ?? email.split("@")[0] ?? email,
            emailVerificadoEm: new Date(),
          }),
        });
      }

      const existing = await ctx.client.organizacaoMembro.findFirst({
        where: { organizacaoId: invite.organizacaoId, usuarioId: user.id },
      });
      if (!existing) {
        await ctx.client.organizacaoMembro.create({
          data: appCreateData({
            organizacaoId: invite.organizacaoId,
            usuarioId: user.id,
            papel: invite.papel,
            convidadoEm: invite.criadoEm,
            ingressouEm: new Date(),
          }),
        });
      }

      await ctx.client.organizacaoConvite.update({
        where: { id: invite.id },
        data: { aceitoEm: new Date() },
      });

      return { ok: true, organizacaoHash: invite.organizacao.uuid };
    },
  },
};
