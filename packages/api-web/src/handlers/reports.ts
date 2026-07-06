import { forbidden, notFound } from "@whasap/api-core";
import { conversations, instances, messages } from "@whasap/db";
import { and, count, eq, gte, inArray, lte } from "drizzle-orm";

import type { WebContext } from "../types";
import { requireAuth, requireOrgInternal } from "./auth";

const visaoGeralVazia = {
  totalConversas: 0,
  conversasAbertas: 0,
  conversasFechadas: 0,
  mensagensEnviadas: 0,
  mensagensRecebidas: 0,
  tempoMedioPrimeiraRespostaMinutos: null,
  porAgente: [] as Array<{
    usuarioId: string;
    nome: string;
    conversasAtribuidas: number;
    mensagensEnviadas: number;
  }>,
  porInstancia: [] as Array<{ instanciaId: string; nome: string; conversas: number }>,
};

export const relatoriosHandlers = {
  visaoGeral: async (
    ctx: WebContext,
    input: {
      organizacaoId: string;
      de: string;
      ate: string;
      instanciaId?: string;
    },
  ) => {
    requireAuth(ctx);
    const internalOrgId = await ctx.client.organizations
      .findFirst({ where: { uuid: input.organizacaoId }, select: { id: true } })
      .then((row) => row?.id ?? null);
    if (internalOrgId === null) notFound();
    requireOrgInternal(ctx, internalOrgId);
    if (ctx.role === "usuario") {
      forbidden("Relatórios não disponíveis para usuário");
    }

    const from = new Date(input.de);
    const to = new Date(input.ate);

    let instanceRows = await ctx.db
      .select()
      .from(instances)
      .where(eq(instances.organizationId, internalOrgId));

    if (input.instanciaId) {
      const filterId = await ctx.client.instances
        .findFirst({ where: { uuid: input.instanciaId }, select: { id: true } })
        .then((row) => row?.id ?? null);
      if (filterId === null) return visaoGeralVazia;
      instanceRows = instanceRows.filter((i) => i.id === filterId);
    }

    if (instanceRows.length === 0) return visaoGeralVazia;

    const instanceIds = instanceRows.map((i) => i.id);

    const convRows = await ctx.db
      .select()
      .from(conversations)
      .where(
        and(
          inArray(conversations.instanceId, instanceIds),
          gte(conversations.criadoEm, from),
          lte(conversations.criadoEm, to),
        ),
      );

    const conversasAbertas = convRows.filter((c) => c.status === "open").length;
    const conversasFechadas = convRows.filter((c) => c.status === "closed").length;

    let mensagensEnviadas = 0;
    let mensagensRecebidas = 0;
    for (const conv of convRows) {
      const [sent] = await ctx.db
        .select({ n: count() })
        .from(messages)
        .where(
          and(
            eq(messages.conversationId, conv.id),
            eq(messages.direction, "outbound"),
            gte(messages.criadoEm, from),
            lte(messages.criadoEm, to),
          ),
        );
      const [recv] = await ctx.db
        .select({ n: count() })
        .from(messages)
        .where(
          and(
            eq(messages.conversationId, conv.id),
            eq(messages.direction, "inbound"),
            gte(messages.criadoEm, from),
            lte(messages.criadoEm, to),
          ),
        );
      mensagensEnviadas += sent?.n ?? 0;
      mensagensRecebidas += recv?.n ?? 0;
    }

    const members = await ctx.client.organizationMembers.findMany({
      where: { organizationId: internalOrgId },
      include: { usuario: true },
    });

    const porAgente = [];
    for (const member of members) {
      if (!member.usuario) continue;
      const assigned = convRows.filter((c) => c.assignedUsuarioId === member.usuarioId).length;
      const [sent] = await ctx.db
        .select({ n: count() })
        .from(messages)
        .where(
          and(
            eq(messages.sentByUsuarioId, member.usuarioId),
            eq(messages.direction, "outbound"),
            gte(messages.criadoEm, from),
            lte(messages.criadoEm, to),
          ),
        );
      porAgente.push({
        usuarioId: member.usuario.uuid,
        nome: member.usuario.nome,
        conversasAtribuidas: assigned,
        mensagensEnviadas: sent?.n ?? 0,
      });
    }

    const porInstancia = instanceRows.map((inst) => ({
      instanciaId: inst.uuid,
      nome: inst.name,
      conversas: convRows.filter((c) => c.instanceId === inst.id).length,
    }));

    return {
      totalConversas: convRows.length,
      conversasAbertas,
      conversasFechadas,
      mensagensEnviadas,
      mensagensRecebidas,
      tempoMedioPrimeiraRespostaMinutos: null,
      porAgente,
      porInstancia,
    };
  },
};