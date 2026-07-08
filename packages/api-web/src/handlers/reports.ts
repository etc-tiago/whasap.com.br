import { forbidden, notFound } from "@whasap/api-core";
import {
  conversa,
  instancia,
  mensagem,
  organizacao,
  organizacaoMembro,
  colunasOrganizacaoSomenteId,
  incluirUsuarioRelacao,
  resolverIdInterno,
} from "@whasap/db";
import { and, count, eq, gte, inArray, isNull, lte } from "drizzle-orm";

import type { WebContext } from "../types";
import { exigirAutenticacao, resolverMembroPorIdInterno } from "./auth";
import { exigirAcessoDemonstracao } from "../lib/demonstracao";

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
  /**
   * Visão geral de conversas e mensagens no período.
   * Bloqueado para membros com papel `usuario` (apenas admin/analista).
   */
  visaoGeral: async (
    ctx: WebContext,
    input: {
      organizacaoHash: string;
      de: string;
      ate: string;
      instanciaId?: string;
    },
  ) => {
    exigirAutenticacao(ctx);
    const orgRow = await ctx.db.query.organizacao.findFirst({
      where: and(eq(organizacao.uuid, input.organizacaoHash), isNull(organizacao.excluidoEm)),
      columns: colunasOrganizacaoSomenteId,
    });
    const internalOrgId = orgRow?.id ?? null;
    if (internalOrgId === null) notFound();
    const { role } = await resolverMembroPorIdInterno(ctx, internalOrgId);
    if (role === "usuario") {
      forbidden("Relatórios não disponíveis para usuario");
    }
    await exigirAcessoDemonstracao(ctx, internalOrgId);

    const from = new Date(input.de);
    const to = new Date(input.ate);

    let instanceRows = await ctx.db
      .select()
      .from(instancia)
      .where(and(eq(instancia.organizacaoId, internalOrgId), isNull(instancia.excluidoEm)));

    if (input.instanciaId) {
      const filterId = await resolverIdInterno(ctx.db, "instancia", input.instanciaId);
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
          isNull(conversa.excluidoEm),
          gte(conversa.criadoEm, from),
          lte(conversa.criadoEm, to),
        ),
      );

    const conversasAbertas = convRows.filter((c) => c.status === "open").length;
    const conversasFechadas = convRows.filter((c) => c.status === "closed").length;

    const messageCounts = await Promise.all(
      convRows.map(async (conv) => {
        const [[sent], [recv]] = await Promise.all([
          ctx.db
            .select({ n: count() })
            .from(mensagem)
            .where(
              and(
                eq(mensagem.conversaId, conv.id),
                isNull(mensagem.excluidoEm),
                eq(mensagem.direcao, "outbound"),
                gte(mensagem.criadoEm, from),
                lte(mensagem.criadoEm, to),
              ),
            ),
          ctx.db
            .select({ n: count() })
            .from(mensagem)
            .where(
              and(
                eq(mensagem.conversaId, conv.id),
                isNull(mensagem.excluidoEm),
                eq(mensagem.direcao, "inbound"),
                gte(mensagem.criadoEm, from),
                lte(mensagem.criadoEm, to),
              ),
            ),
        ]);
        return { sent: sent?.n ?? 0, recv: recv?.n ?? 0 };
      }),
    );
    const mensagensEnviadas = messageCounts.reduce((sum, c) => sum + c.sent, 0);
    const mensagensRecebidas = messageCounts.reduce((sum, c) => sum + c.recv, 0);

    const members = await ctx.db.query.organizacaoMembro.findMany({
      where: and(
        eq(organizacaoMembro.organizacaoId, internalOrgId),
        isNull(organizacaoMembro.excluidoEm),
      ),
      columns: { usuarioId: true },
      with: { usuario: incluirUsuarioRelacao },
    });

    const porAgente = await Promise.all(
      members
        .filter(
          (member): member is typeof member & { usuario: NonNullable<typeof member.usuario> } =>
            Boolean(member.usuario),
        )
        .map(async (member) => {
          const assigned = convRows.filter((c) => c.atribuidoUsuarioId === member.usuarioId).length;
          const [sent] = await ctx.db
            .select({ n: count() })
            .from(mensagem)
            .where(
              and(
                eq(mensagem.enviadoPorUsuarioId, member.usuarioId),
                isNull(mensagem.excluidoEm),
                eq(mensagem.direcao, "outbound"),
                gte(mensagem.criadoEm, from),
                lte(mensagem.criadoEm, to),
              ),
            );
          return {
            usuarioId: member.usuario.uuid,
            nome: member.usuario.nome,
            conversasAtribuidas: assigned,
            mensagensEnviadas: sent?.n ?? 0,
          };
        }),
    );

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
