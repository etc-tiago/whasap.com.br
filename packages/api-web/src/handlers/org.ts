import {
  badRequest,
  forbidden,
  notFound,
  sendInviteEmail,
  slugify,
  verificarOtp,
} from "@whasap/api-core";
import {
  cnpjValido,
  mvpDefaults,
  normalizarTelefoneWhatsappBr,
  somenteDigitos,
  telefoneWhatsappBrValido,
} from "@whasap/config";
import {
  colunasConviteOrganizacao,
  colunasMembroOrganizacao,
  colunasOrganizacaoPublica,
  colunasOrganizacaoSomenteId,
  colunasUsuarioSessao,
  comCriadoEm,
  comTimestampAtualizacao,
  comTimestampsCriacao,
  conversa,
  incluirOrganizacaoPublica,
  incluirUsuarioRelacao,
  instancia,
  marcarExclusaoLogica,
  mensagem,
  organizacao,
  organizacaoConvite,
  organizacaoMembro,
  resolverIdInterno,
  usuario,
} from "@whasap/db";
import { and, eq, inArray, isNull, max } from "drizzle-orm";

import { toOrganizacaoOutput } from "../lib/mappers";
import { persistSessionOrganization } from "../lib/session";
import type { WebContext } from "../types";
import {
  exigirAdmin,
  exigirAdminPorIdInterno,
  exigirAutenticacao,
  exigirOrganizacaoPorIdInterno,
  resolverMembro,
} from "./auth";

export const organizacaoHandlers = {
  /** Lista organizações do usuário autenticado, ordenadas por data de ingresso. */
  lista: async (ctx: WebContext) => {
    const current = exigirAutenticacao(ctx);
    const rows = await ctx.db.query.organizacaoMembro.findMany({
      where: and(
        eq(organizacaoMembro.usuarioId, current.internalId),
        isNull(organizacaoMembro.excluidoEm),
      ),
      columns: { ingressouEm: true },
      with: { organizacao: incluirOrganizacaoPublica },
    });
    return rows
      .filter((r) => r.organizacao)
      .toSorted((a, b) => a.ingressouEm.getTime() - b.ingressouEm.getTime())
      .map((r) => toOrganizacaoOutput(r.organizacao!));
  },

  /** Cria organização com cadastro fiscal + aceite do termo e adiciona o usuário como admin. */
  criar: async (
    ctx: WebContext,
    input: {
      nome: string;
      documento: string;
      tipoDocumento: "cnpj";
      razaoSocial: string;
      telefoneWhatsapp: string;
      aceiteAdesao: true;
    },
  ) => {
    const current = exigirAutenticacao(ctx);
    const now = new Date();

    const documento = somenteDigitos(input.documento);
    if (!cnpjValido(documento)) badRequest("CNPJ inválido");
    if (!telefoneWhatsappBrValido(input.telefoneWhatsapp)) badRequest("WhatsApp inválido");
    const telefoneWhatsapp = normalizarTelefoneWhatsappBr(input.telefoneWhatsapp);

    let slug = slugify(input.nome);
    const slugConflict = await ctx.db.query.organizacao.findFirst({
      where: and(eq(organizacao.slug, slug), isNull(organizacao.excluidoEm)),
      columns: colunasOrganizacaoSomenteId,
    });
    if (slugConflict) slug = `${slug}-${crypto.randomUUID().slice(0, 8)}`;

    const [org] = await ctx.db
      .insert(organizacao)
      .values(
        comTimestampsCriacao({
          nome: input.nome,
          slug,
          documentoFiscal: documento,
          tipoDocumento: "cnpj",
          razaoSocial: input.razaoSocial.trim(),
          telefoneWhatsapp,
          aceiteAdesaoEm: now,
          aceiteAdesaoVersao: mvpDefaults.legal.adesaoVersao,
        }),
      )
      .returning();

    await ctx.db.insert(organizacaoMembro).values(
      comCriadoEm({
        organizacaoId: org!.id,
        usuarioId: current.internalId,
        papel: "admin",
        ingressouEm: now,
      }),
    );

    return toOrganizacaoOutput(org!);
  },

  /** Retorna organização e papel do membro na sessão. */
  obter: async (ctx: WebContext, input: { organizacaoHash: string }) => {
    const { role } = await resolverMembro(ctx, input.organizacaoHash);
    const org = await ctx.db.query.organizacao.findFirst({
      where: and(eq(organizacao.uuid, input.organizacaoHash), isNull(organizacao.excluidoEm)),
      columns: colunasOrganizacaoPublica,
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
      tipoDocumento?: "cnpj";
      razaoSocial?: string;
      telefoneWhatsapp?: string;
      horasAutoFecharInatividade?: string;
      exibirNomeAtendenteMensagens?: boolean;
      campanhaHabilitada?: boolean;
      campanhaLimitePorMinuto?: number;
      campanhaLimitePorHora?: number;
      campanhaAlertaConsecutivos?: number;
    },
  ) => {
    await exigirAdmin(ctx, input.organizacaoHash);
    const internalOrgId = await resolverIdInterno(ctx.db, "organizacao", input.organizacaoHash);
    if (internalOrgId === null) notFound();

    let documentoFiscal: string | undefined;
    if (input.documento !== undefined) {
      documentoFiscal = somenteDigitos(input.documento);
      if (!cnpjValido(documentoFiscal)) badRequest("CNPJ inválido");
    }
    let telefoneWhatsapp: string | undefined;
    if (input.telefoneWhatsapp !== undefined) {
      if (!telefoneWhatsappBrValido(input.telefoneWhatsapp)) badRequest("WhatsApp inválido");
      telefoneWhatsapp = normalizarTelefoneWhatsappBr(input.telefoneWhatsapp);
    }
    if (input.horasAutoFecharInatividade !== undefined) {
      const horas = Number.parseInt(input.horasAutoFecharInatividade, 10);
      if (!Number.isFinite(horas) || horas < 1 || horas > 8760) {
        badRequest("Horas de auto-fechar deve ser entre 1 e 8760");
      }
    }
    if (input.campanhaLimitePorMinuto !== undefined) {
      if (
        !Number.isFinite(input.campanhaLimitePorMinuto) ||
        input.campanhaLimitePorMinuto < 0 ||
        input.campanhaLimitePorMinuto > 1000
      ) {
        badRequest("Limite por minuto deve ser entre 0 e 1000");
      }
    }
    if (input.campanhaLimitePorHora !== undefined) {
      if (
        !Number.isFinite(input.campanhaLimitePorHora) ||
        input.campanhaLimitePorHora < 0 ||
        input.campanhaLimitePorHora > 10000
      ) {
        badRequest("Limite por hora deve ser entre 0 e 10000");
      }
    }
    if (input.campanhaAlertaConsecutivos !== undefined) {
      if (
        !Number.isFinite(input.campanhaAlertaConsecutivos) ||
        input.campanhaAlertaConsecutivos < 1 ||
        input.campanhaAlertaConsecutivos > 1000
      ) {
        badRequest("Alerta de consecutivos deve ser entre 1 e 1000");
      }
    }

    const [org] = await ctx.db
      .update(organizacao)
      .set(
        comTimestampAtualizacao({
          nome: input.nome,
          documentoFiscal,
          tipoDocumento: input.tipoDocumento,
          razaoSocial: input.razaoSocial,
          telefoneWhatsapp,
          horasAutoFecharInatividade: input.horasAutoFecharInatividade,
          exibirNomeAtendenteMensagens: input.exibirNomeAtendenteMensagens,
          campanhaHabilitada: input.campanhaHabilitada,
          campanhaLimitePorMinuto: input.campanhaLimitePorMinuto,
          campanhaLimitePorHora: input.campanhaLimitePorHora,
          campanhaAlertaConsecutivos: input.campanhaAlertaConsecutivos,
        }),
      )
      .where(and(eq(organizacao.uuid, input.organizacaoHash), isNull(organizacao.excluidoEm)))
      .returning();
    if (!org) notFound();
    return toOrganizacaoOutput(org);
  },

  trocar: async (ctx: WebContext, input: { organizacaoHash: string }) => {
    const current = exigirAutenticacao(ctx);
    const internalOrgId = await resolverIdInterno(ctx.db, "organizacao", input.organizacaoHash);
    if (internalOrgId === null) notFound();

    const membership = await ctx.db.query.organizacaoMembro.findFirst({
      where: and(
        eq(organizacaoMembro.usuarioId, current.internalId),
        eq(organizacaoMembro.organizacaoId, internalOrgId),
        isNull(organizacaoMembro.excluidoEm),
      ),
      columns: colunasMembroOrganizacao,
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
      const internalOrgId = await resolverIdInterno(ctx.db, "organizacao", input.organizacaoHash);
      if (internalOrgId === null) notFound();
      await exigirOrganizacaoPorIdInterno(ctx, internalOrgId);
      const rows = await ctx.db.query.organizacaoMembro.findMany({
        where: and(
          eq(organizacaoMembro.organizacaoId, internalOrgId),
          isNull(organizacaoMembro.excluidoEm),
        ),
        columns: { uuid: true, papel: true, usuarioId: true },
        with: {
          organizacao: incluirOrganizacaoPublica,
          usuario: incluirUsuarioRelacao,
        },
      });

      const membrosValidos = rows.filter((r) => r.organizacao && r.usuario);
      const usuarioIdsInternos = [
        ...new Set(membrosValidos.map((r) => r.usuarioId).filter((id): id is number => id != null)),
      ];

      const ultimaMsgPorUsuario = new Map<number, Date>();
      if (usuarioIdsInternos.length > 0) {
        const instancias = await ctx.db.query.instancia.findMany({
          where: and(eq(instancia.organizacaoId, internalOrgId), isNull(instancia.excluidoEm)),
          columns: { id: true },
        });
        const instanciaIds = instancias.map((i) => i.id);
        if (instanciaIds.length > 0) {
          const agregados = await ctx.db
            .select({
              usuarioId: mensagem.enviadoPorUsuarioId,
              em: max(mensagem.enviadoEm),
            })
            .from(mensagem)
            .innerJoin(conversa, eq(conversa.id, mensagem.conversaId))
            .where(
              and(
                inArray(conversa.instanciaId, instanciaIds),
                inArray(mensagem.enviadoPorUsuarioId, usuarioIdsInternos),
                eq(mensagem.direcao, "outbound"),
              ),
            )
            .groupBy(mensagem.enviadoPorUsuarioId);

          for (const row of agregados) {
            if (row.usuarioId != null && row.em != null) {
              ultimaMsgPorUsuario.set(row.usuarioId, row.em);
            }
          }
        }
      }

      return membrosValidos.map((r) => {
        const ultimaMsg = ultimaMsgPorUsuario.get(r.usuarioId);
        return {
          id: r.uuid,
          organizacaoId: r.organizacao!.uuid,
          usuarioId: r.usuario!.uuid,
          usuarioNome: r.usuario!.nome,
          usuarioEmail: r.usuario!.email,
          role: r.papel,
          ultimaAtividadeEm: r.usuario!.ultimaAtividadeEm?.toISOString() ?? null,
          ultimaMensagemEnviadaEm: ultimaMsg?.toISOString() ?? null,
        };
      });
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
      const internalOrgId = await resolverIdInterno(ctx.db, "organizacao", input.organizacaoHash);
      if (internalOrgId === null) notFound();
      await exigirAdminPorIdInterno(ctx, internalOrgId);
      const org = await ctx.db.query.organizacao.findFirst({
        where: and(eq(organizacao.id, internalOrgId), isNull(organizacao.excluidoEm)),
        columns: { id: true, uuid: true, nome: true },
      });
      if (!org) notFound();

      const token = crypto.randomUUID();
      const expiraEm = new Date(
        Date.now() + mvpDefaults.team.inviteExpiresDays * 24 * 60 * 60 * 1000,
      );
      const [invite] = await ctx.db
        .insert(organizacaoConvite)
        .values(
          comCriadoEm({
            organizacaoId: internalOrgId,
            email: input.email.toLowerCase(),
            nome: input.nome,
            papel: input.role,
            token,
            expiraEm,
            criadoPorUsuarioId: ctx.usuario!.internalId,
          }),
        )
        .returning({ uuid: organizacaoConvite.uuid });
      const urlConvite = `${ctx.env.WEB_URL}/convite/${token}`;
      await sendInviteEmail(ctx.env, input.email, org.nome, urlConvite);
      return { conviteId: invite!.uuid, urlConvite };
    },

    atualizarPapel: async (
      ctx: WebContext,
      input: { membroId: string; role: "admin" | "usuario" | "analista" },
    ) => {
      exigirAutenticacao(ctx);
      const member = await ctx.db.query.organizacaoMembro.findFirst({
        where: and(
          eq(organizacaoMembro.uuid, input.membroId),
          isNull(organizacaoMembro.excluidoEm),
        ),
        columns: colunasMembroOrganizacao,
      });
      if (!member) notFound();
      await exigirAdminPorIdInterno(ctx, member.organizacaoId);
      await ctx.db
        .update(organizacaoMembro)
        .set({ papel: input.role })
        .where(eq(organizacaoMembro.id, member.id));
      return { ok: true };
    },

    desativar: async (ctx: WebContext, input: { membroId: string }) => {
      exigirAutenticacao(ctx);
      const member = await ctx.db.query.organizacaoMembro.findFirst({
        where: and(
          eq(organizacaoMembro.uuid, input.membroId),
          isNull(organizacaoMembro.excluidoEm),
        ),
        columns: colunasMembroOrganizacao,
      });
      if (!member) notFound();
      await exigirAdminPorIdInterno(ctx, member.organizacaoId);
      if (member.usuarioId === ctx.usuario!.internalId)
        forbidden("Não é possível remover a si mesmo");

      await ctx.db
        .update(organizacaoMembro)
        .set(marcarExclusaoLogica())
        .where(eq(organizacaoMembro.id, member.id));
      return { ok: true };
    },
  },

  convites: {
    lista: async (ctx: WebContext, input: { organizacaoHash: string }) => {
      const internalOrgId = await resolverIdInterno(ctx.db, "organizacao", input.organizacaoHash);
      if (internalOrgId === null) notFound();
      await exigirAdminPorIdInterno(ctx, internalOrgId);
      const rows = await ctx.db.query.organizacaoConvite.findMany({
        where: and(
          eq(organizacaoConvite.organizacaoId, internalOrgId),
          isNull(organizacaoConvite.excluidoEm),
        ),
        columns: {
          uuid: true,
          email: true,
          nome: true,
          papel: true,
          expiraEm: true,
          aceitoEm: true,
        },
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

    aceitar: async (ctx: WebContext, input: { token: string; otp: string }) => {
      const invite = await ctx.db.query.organizacaoConvite.findFirst({
        where: and(
          eq(organizacaoConvite.token, input.token),
          isNull(organizacaoConvite.excluidoEm),
        ),
        columns: colunasConviteOrganizacao,
        with: { organizacao: incluirOrganizacaoPublica },
      });
      if (!invite?.organizacao) notFound();
      if (invite.aceitoEm) forbidden("Convite já aceito");
      if (invite.expiraEm < new Date()) forbidden("Convite expirado");

      const email = invite.email.toLowerCase();
      const valid = await verificarOtp(ctx, email, "invite", input.otp);
      if (!valid) forbidden("Código inválido ou expirado");

      let user = await ctx.db.query.usuario.findFirst({
        where: and(eq(usuario.email, email), isNull(usuario.excluidoEm)),
        columns: colunasUsuarioSessao,
      });
      if (!user) {
        [user] = await ctx.db
          .insert(usuario)
          .values(
            comTimestampsCriacao({
              email,
              nome: invite.nome ?? email.split("@")[0] ?? email,
              emailVerificadoEm: new Date(),
            }),
          )
          .returning();
      }

      const existing = await ctx.db.query.organizacaoMembro.findFirst({
        where: and(
          eq(organizacaoMembro.organizacaoId, invite.organizacaoId),
          eq(organizacaoMembro.usuarioId, user!.id),
          isNull(organizacaoMembro.excluidoEm),
        ),
        columns: colunasOrganizacaoSomenteId,
      });
      if (!existing) {
        await ctx.db.insert(organizacaoMembro).values(
          comCriadoEm({
            organizacaoId: invite.organizacaoId,
            usuarioId: user!.id,
            papel: invite.papel,
            convidadoEm: invite.criadoEm,
            ingressouEm: new Date(),
          }),
        );
      }

      await ctx.db
        .update(organizacaoConvite)
        .set({ aceitoEm: new Date() })
        .where(eq(organizacaoConvite.id, invite.id));

      return { ok: true, organizacaoHash: invite.organizacao.uuid };
    },
  },
};
