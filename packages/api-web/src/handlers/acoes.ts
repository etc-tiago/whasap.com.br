import {
  filtroConversasInativas,
  limiteInatividadeConversa,
  forbidden,
  notFound,
} from "@whasap/api-core";
import {
  colunasOrganizacaoPublica,
  comCriadoEm,
  comTimestampAtualizacao,
  contatoTag,
  contatoTagAtribuicao,
  conversa,
  instancia,
  organizacao,
  organizacaoMembro,
  resolverIdInterno,
} from "@whasap/db";
import { and, asc, count, eq, gt, inArray, isNull, or } from "drizzle-orm";

import type { WebContext } from "../types";
import { exigirAutenticacao, resolverMembro } from "./auth";

type EscopoAcoes = {
  organizacaoHash: string;
  instanciaId?: string;
};

/**
 * Resolve ids internos da org e das instâncias no escopo (todas ou uma).
 */
async function resolverEscopoInstancias(ctx: WebContext, input: EscopoAcoes) {
  const { role } = await resolverMembro(ctx, input.organizacaoHash);
  const orgId = await resolverIdInterno(ctx.db, "organizacao", input.organizacaoHash);
  if (orgId === null) notFound();

  const org = await ctx.db.query.organizacao.findFirst({
    where: and(eq(organizacao.id, orgId), isNull(organizacao.excluidoEm)),
    columns: colunasOrganizacaoPublica,
  });
  if (!org) notFound();

  let instanceRows = await ctx.db
    .select({ id: instancia.id })
    .from(instancia)
    .where(and(eq(instancia.organizacaoId, orgId), isNull(instancia.excluidoEm)));

  if (input.instanciaId) {
    const filterId = await resolverIdInterno(ctx.db, "instancia", input.instanciaId);
    if (filterId === null) notFound("Instância não encontrada");
    instanceRows = instanceRows.filter((i) => i.id === filterId);
    if (instanceRows.length === 0) notFound("Instância não encontrada");
  }

  return {
    role,
    orgId,
    org,
    instanceIds: instanceRows.map((i) => i.id),
    horasAutoFechar: Number.parseInt(org.horasAutoFecharInatividade ?? "72", 10) || 72,
  };
}

function filtroAbertas(instanceIds: number[]) {
  return and(
    inArray(conversa.instanciaId, instanceIds),
    eq(conversa.status, "open"),
    isNull(conversa.excluidoEm),
  );
}

function exigirAdminAcao(role: string) {
  if (role !== "admin") forbidden("Apenas administradores podem executar esta ação");
}

function exigirPodeAtribuir(role: string) {
  if (role !== "admin" && role !== "usuario") {
    forbidden("Sem permissão para atribuir conversas");
  }
}

export const acoesHandlers = {
  /**
   * Contagens para o painel Ações (abertas, sem dono, não lidas, inativas, minhas).
   */
  resumo: async (ctx: WebContext, input: EscopoAcoes) => {
    const current = exigirAutenticacao(ctx);
    const { instanceIds, horasAutoFechar, org } = await resolverEscopoInstancias(ctx, input);

    if (instanceIds.length === 0) {
      return {
        abertas: 0,
        semDono: 0,
        comNaoLidas: 0,
        inativas: 0,
        minhasAtribuidas: 0,
        horasAutoFecharInatividade: org.horasAutoFecharInatividade ?? "72",
      };
    }

    const limite = limiteInatividadeConversa(horasAutoFechar);
    const base = filtroAbertas(instanceIds)!;

    const [[abertas], [semDono], [comNaoLidas], [inativas], [minhasAtribuidas]] = await Promise.all(
      [
        ctx.db.select({ n: count() }).from(conversa).where(base),
        ctx.db
          .select({ n: count() })
          .from(conversa)
          .where(and(base, isNull(conversa.atribuidoUsuarioId))),
        ctx.db
          .select({ n: count() })
          .from(conversa)
          .where(and(base, gt(conversa.naoLidas, 0))),
        ctx.db
          .select({ n: count() })
          .from(conversa)
          .where(filtroConversasInativas(instanceIds, limite)),
        ctx.db
          .select({ n: count() })
          .from(conversa)
          .where(and(base, eq(conversa.atribuidoUsuarioId, current.internalId))),
      ],
    );

    return {
      abertas: abertas?.n ?? 0,
      semDono: semDono?.n ?? 0,
      comNaoLidas: comNaoLidas?.n ?? 0,
      inativas: inativas?.n ?? 0,
      minhasAtribuidas: minhasAtribuidas?.n ?? 0,
      horasAutoFecharInatividade: org.horasAutoFecharInatividade ?? "72",
    };
  },

  /** Fecha todas as conversas abertas no escopo. */
  finalizarTodas: async (ctx: WebContext, input: EscopoAcoes) => {
    exigirAutenticacao(ctx);
    const { role, instanceIds } = await resolverEscopoInstancias(ctx, input);
    exigirAdminAcao(role);
    if (instanceIds.length === 0) return { afetadas: 0 };

    const now = new Date();
    const rows = await ctx.db
      .update(conversa)
      .set(comTimestampAtualizacao({ status: "closed", fechadoEm: now }))
      .where(filtroAbertas(instanceIds))
      .returning({ id: conversa.id });

    return { afetadas: rows.length };
  },

  /** Fecha conversas abertas sem mensagem recente (threshold da org). */
  finalizarInativas: async (ctx: WebContext, input: EscopoAcoes) => {
    exigirAutenticacao(ctx);
    const { role, instanceIds, horasAutoFechar } = await resolverEscopoInstancias(ctx, input);
    exigirAdminAcao(role);
    if (instanceIds.length === 0) return { afetadas: 0 };

    const now = new Date();
    const limite = limiteInatividadeConversa(horasAutoFechar);
    const rows = await ctx.db
      .update(conversa)
      .set(comTimestampAtualizacao({ status: "closed", fechadoEm: now }))
      .where(filtroConversasInativas(instanceIds, limite))
      .returning({ id: conversa.id });

    return { afetadas: rows.length };
  },

  /** Zera não lidas de todas as conversas abertas no escopo. */
  marcarTodasLidas: async (ctx: WebContext, input: EscopoAcoes) => {
    exigirAutenticacao(ctx);
    const { role, instanceIds } = await resolverEscopoInstancias(ctx, input);
    exigirAdminAcao(role);
    if (instanceIds.length === 0) return { afetadas: 0 };

    const now = new Date();
    const rows = await ctx.db
      .update(conversa)
      .set(comTimestampAtualizacao({ naoLidas: 0, ultimaLeituraEm: now }))
      .where(and(filtroAbertas(instanceIds), gt(conversa.naoLidas, 0)))
      .returning({ id: conversa.id });

    return { afetadas: rows.length };
  },

  /**
   * Distribui conversas abertas sem dono em round-robin entre membros admin/usuario.
   */
  distribuirSemDono: async (ctx: WebContext, input: EscopoAcoes) => {
    exigirAutenticacao(ctx);
    const { role, orgId, instanceIds } = await resolverEscopoInstancias(ctx, input);
    exigirAdminAcao(role);
    if (instanceIds.length === 0) return { afetadas: 0 };

    const membros = await ctx.db.query.organizacaoMembro.findMany({
      where: and(
        eq(organizacaoMembro.organizacaoId, orgId),
        isNull(organizacaoMembro.excluidoEm),
        or(eq(organizacaoMembro.papel, "admin"), eq(organizacaoMembro.papel, "usuario")),
      ),
      columns: { usuarioId: true },
    });
    const memberIds = membros.map((m) => m.usuarioId);
    if (memberIds.length === 0) return { afetadas: 0 };

    const abertas = await ctx.db
      .select({ id: conversa.id })
      .from(conversa)
      .where(and(filtroAbertas(instanceIds), isNull(conversa.atribuidoUsuarioId)))
      .orderBy(asc(conversa.id));

    if (abertas.length === 0) return { afetadas: 0 };

    const porMembro = new Map<number, number[]>();
    for (let i = 0; i < abertas.length; i++) {
      const usuarioId = memberIds[i % memberIds.length]!;
      const lista = porMembro.get(usuarioId) ?? [];
      lista.push(abertas[i]!.id);
      porMembro.set(usuarioId, lista);
    }

    await Promise.all(
      [...porMembro.entries()].map(([usuarioId, ids]) =>
        ctx.db
          .update(conversa)
          .set(comTimestampAtualizacao({ atribuidoUsuarioId: usuarioId }))
          .where(inArray(conversa.id, ids)),
      ),
    );

    return { afetadas: abertas.length };
  },

  /** Atribui ao usuário atual todas as abertas sem dono. */
  assumirSemDono: async (ctx: WebContext, input: EscopoAcoes) => {
    const current = exigirAutenticacao(ctx);
    const { role, instanceIds } = await resolverEscopoInstancias(ctx, input);
    exigirPodeAtribuir(role);
    if (instanceIds.length === 0) return { afetadas: 0 };

    const rows = await ctx.db
      .update(conversa)
      .set(comTimestampAtualizacao({ atribuidoUsuarioId: current.internalId }))
      .where(and(filtroAbertas(instanceIds), isNull(conversa.atribuidoUsuarioId)))
      .returning({ id: conversa.id });

    return { afetadas: rows.length };
  },

  /** Remove atribuição das conversas atribuídas ao usuário atual. */
  liberarMinhas: async (ctx: WebContext, input: EscopoAcoes) => {
    const current = exigirAutenticacao(ctx);
    const { role, instanceIds } = await resolverEscopoInstancias(ctx, input);
    exigirPodeAtribuir(role);
    if (instanceIds.length === 0) return { afetadas: 0 };

    const rows = await ctx.db
      .update(conversa)
      .set(comTimestampAtualizacao({ atribuidoUsuarioId: null }))
      .where(and(filtroAbertas(instanceIds), eq(conversa.atribuidoUsuarioId, current.internalId)))
      .returning({ id: conversa.id });

    return { afetadas: rows.length };
  },

  /**
   * Aplica etiqueta aos contatos das conversas abertas (só DB; sem sync Evolution em massa).
   */
  aplicarEtiquetaAbertas: async (ctx: WebContext, input: EscopoAcoes & { etiquetaId: string }) => {
    exigirAutenticacao(ctx);
    const { role, orgId, instanceIds } = await resolverEscopoInstancias(ctx, input);
    exigirAdminAcao(role);
    if (instanceIds.length === 0) return { afetadas: 0 };

    const tag = await ctx.db.query.contatoTag.findFirst({
      where: eq(contatoTag.uuid, input.etiquetaId),
      columns: { id: true, organizacaoId: true },
    });
    if (!tag || tag.organizacaoId !== orgId) notFound("Etiqueta não encontrada");

    const contatos = await ctx.db
      .selectDistinct({ contatoId: conversa.contatoId })
      .from(conversa)
      .where(filtroAbertas(instanceIds));

    if (contatos.length === 0) return { afetadas: 0 };

    const existentes = await ctx.db
      .select({ contatoId: contatoTagAtribuicao.contatoId })
      .from(contatoTagAtribuicao)
      .where(
        and(
          eq(contatoTagAtribuicao.tagId, tag.id),
          inArray(
            contatoTagAtribuicao.contatoId,
            contatos.map((c) => c.contatoId),
          ),
        ),
      );
    const jaTem = new Set(existentes.map((e) => e.contatoId));
    const novos = contatos.filter((c) => !jaTem.has(c.contatoId));
    if (novos.length === 0) return { afetadas: 0 };

    await ctx.db.insert(contatoTagAtribuicao).values(
      novos.map((c) =>
        comCriadoEm({
          contatoId: c.contatoId,
          tagId: tag.id,
        }),
      ),
    );

    return { afetadas: novos.length };
  },
};
