import { forbidden, notFound } from "@whasap/api-core";
import { conversa, instancia, mensagem } from "@whasap/db";
import { and, count, eq, gte, inArray, lte } from "drizzle-orm";

import type { WebContext } from "../types";
import { requireAuth, requireOrgInternal, resolveMembershipInternal } from "./auth";

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
      organizacaoHash: string;
      de: string;
      ate: string;
      instanciaId?: string;
    },
  ) => {
    requireAuth(ctx);
    const internalOrgId = await ctx.client.organizacao
      .findFirst({ where: { uuid: input.organizacaoHash }, select: { id: true } })
      .then((row) => row?.id ?? null);
    if (internalOrgId === null) notFound();
    const { role } = await resolveMembershipInternal(ctx, internalOrgId);
    if (role === "usuario") {
      forbidden("Relatórios não disponíveis para usuário");
    }

    const from = new Date(input.de);
    const to = new Date(input.ate);

    let instanceRows = await ctx.db
      .select()
      .from(instancia)
      .where(eq(instancia.organizacaoId, internalOrgId));

    if (input.instanciaId) {
      const filterId = await ctx.client.instancia
        .findFirst({ where: { uuid: input.instanciaId }, select: { id: true } })
        .then((row) => row?.id ?? null);
      if (filterId === null) return visaoGeralVazia;
      instanceRows = instanceRows.filter((i) => i.id === filterId);
    }

    if (instanceRows.length === 0) return visaoGeralVazia;

    const instanceIds = instanceRows.map((i) => i.id);

    const convRows = await ctx.db
      .select()
      .from(conversa)
      .where(
        and(
          inArray(conversa.instanciaId, instanceIds),
          gte(conversa.criadoEm, from),
          lte(conversa.criadoEm, to),
        ),
      );

    const conversasAbertas = convRows.filter((c) => c.status === "open").length;
    const conversasFechadas = convRows.filter((c) => c.status === "closed").length;

    let mensagensEnviadas = 0;
    let mensagensRecebidas = 0;
    for (const conv of convRows) {
      const [sent] = await ctx.db
        .select({ n: count() })
        .from(mensagem)
        .where(
          and(
            eq(mensagem.conversaId, conv.id),
            eq(mensagem.direcao, "outbound"),
            gte(mensagem.criadoEm, from),
            lte(mensagem.criadoEm, to),
          ),
        );
      const [recv] = await ctx.db
        .select({ n: count() })
        .from(mensagem)
        .where(
          and(
            eq(mensagem.conversaId, conv.id),
            eq(mensagem.direcao, "inbound"),
            gte(mensagem.criadoEm, from),
            lte(mensagem.criadoEm, to),
          ),
        );
      mensagensEnviadas += sent?.n ?? 0;
      mensagensRecebidas += recv?.n ?? 0;
    }

    const members = await ctx.client.organizacaoMembro.findMany({
      where: { organizacaoId: internalOrgId },
      include: { usuario: true },
    });

    const porAgente = [];
    for (const member of members) {
      if (!member.usuario) continue;
      const assigned = convRows.filter((c) => c.atribuidoUsuarioId === member.usuarioId).length;
      const [sent] = await ctx.db
        .select({ n: count() })
        .from(mensagem)
        .where(
          and(
            eq(mensagem.enviadoPorUsuarioId, member.usuarioId),
            eq(mensagem.direcao, "outbound"),
            gte(mensagem.criadoEm, from),
            lte(mensagem.criadoEm, to),
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
      nome: inst.nome,
      conversas: convRows.filter((c) => c.instanciaId === inst.id).length,
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
