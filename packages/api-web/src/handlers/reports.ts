import { forbidden, notFound } from "@whasap/api-core";
import {
  contatoTag,
  contatoTagAtribuicao,
  conversa,
  instancia,
  mensagem,
  organizacao,
  organizacaoMembro,
  colunasOrganizacaoSomenteId,
  incluirUsuarioRelacao,
  resolverIdInterno,
} from "@whasap/db";
import { and, asc, count, desc, eq, gte, inArray, isNull, lte, min } from "drizzle-orm";

import type { WebContext } from "../types";
import { exigirAutenticacao, resolverMembroPorIdInterno } from "./auth";
type DistribuicaoTempoResposta = {
  ate5Min: number;
  de5a15Min: number;
  de15a60Min: number;
  acima60Min: number;
  semResposta: number;
};

const distribuicaoVazia = (): DistribuicaoTempoResposta => ({
  ate5Min: 0,
  de5a15Min: 0,
  de15a60Min: 0,
  acima60Min: 0,
  semResposta: 0,
});

const visaoGeralVazia = {
  totalConversas: 0,
  conversasAbertas: 0,
  conversasFechadas: 0,
  totalContatos: 0,
  mensagensEnviadas: 0,
  mensagensRecebidas: 0,
  tempoMedioPrimeiraRespostaMinutos: null as number | null,
  tempoMedianoPrimeiraRespostaMinutos: null as number | null,
  conversasComResposta: 0,
  distribuicaoTempoResposta: distribuicaoVazia(),
  itensInteresse: 0,
  porItemInteresse: [] as Array<{
    id: string;
    nome: string;
    cor: string | null;
    total: number;
  }>,
  porAgente: [] as Array<{
    usuarioId: string;
    nome: string;
    conversasAtribuidas: number;
    mensagensEnviadas: number;
    tempoMedioPrimeiraRespostaMinutos: number | null;
  }>,
  porInstancia: [] as Array<{ instanciaId: string; nome: string; conversas: number }>,
};

/**
 * Converte deltas em minutos para média, mediana e faixas de distribuição.
 * Conversas sem resposta entram só em `semResposta`.
 */
function analisarTemposResposta(
  deltasMinutos: number[],
  totalConversas: number,
): {
  media: number | null;
  mediana: number | null;
  comResposta: number;
  distribuicao: DistribuicaoTempoResposta;
} {
  const distribuicao = distribuicaoVazia();
  distribuicao.semResposta = Math.max(0, totalConversas - deltasMinutos.length);

  for (const minutos of deltasMinutos) {
    if (minutos <= 5) distribuicao.ate5Min += 1;
    else if (minutos <= 15) distribuicao.de5a15Min += 1;
    else if (minutos <= 60) distribuicao.de15a60Min += 1;
    else distribuicao.acima60Min += 1;
  }

  if (deltasMinutos.length === 0) {
    return { media: null, mediana: null, comResposta: 0, distribuicao };
  }

  const soma = deltasMinutos.reduce((acc, n) => acc + n, 0);
  const media = Math.round((soma / deltasMinutos.length) * 10) / 10;

  const ordenados = [...deltasMinutos].toSorted((a, b) => a - b);
  const meio = Math.floor(ordenados.length / 2);
  const mediana =
    ordenados.length % 2 === 0
      ? Math.round(((ordenados[meio - 1]! + ordenados[meio]!) / 2) * 10) / 10
      : Math.round(ordenados[meio]! * 10) / 10;

  return { media, mediana, comResposta: deltasMinutos.length, distribuicao };
}

/**
 * Tempo em minutos entre o 1º inbound e o 1º outbound posterior, por conversa.
 * @returns mapa conversaId interno → minutos (só conversas com resposta).
 */
async function calcularDeltasPrimeiraResposta(
  ctx: WebContext,
  conversaIds: number[],
): Promise<Map<number, number>> {
  const deltas = new Map<number, number>();
  if (conversaIds.length === 0) return deltas;

  const primeirosInbound = await ctx.db
    .select({
      conversaId: mensagem.conversaId,
      em: min(mensagem.criadoEm),
    })
    .from(mensagem)
    .where(and(inArray(mensagem.conversaId, conversaIds), eq(mensagem.direcao, "inbound")))
    .groupBy(mensagem.conversaId);

  if (primeirosInbound.length === 0) return deltas;

  const inboundPorConversa = new Map(
    primeirosInbound
      .filter((r): r is typeof r & { em: Date } => r.em != null)
      .map((r) => [r.conversaId, r.em] as const),
  );

  const outbounds = await ctx.db
    .select({
      conversaId: mensagem.conversaId,
      em: mensagem.criadoEm,
    })
    .from(mensagem)
    .where(
      and(
        inArray(mensagem.conversaId, [...inboundPorConversa.keys()]),
        eq(mensagem.direcao, "outbound"),
      ),
    )
    .orderBy(asc(mensagem.criadoEm));

  for (const row of outbounds) {
    if (deltas.has(row.conversaId)) continue;
    const inboundEm = inboundPorConversa.get(row.conversaId);
    if (!inboundEm || row.em <= inboundEm) continue;
    const minutos = (row.em.getTime() - inboundEm.getTime()) / 60_000;
    if (minutos >= 0) deltas.set(row.conversaId, minutos);
  }

  return deltas;
}

export const relatoriosHandlers = {
  /**
   * Visão geral de conversas, contatos, tempo de resposta e itens de interesse (etiquetas).
   * Bloqueado para membros com papel `usuario` (apenas admin/analista).
   * Soft-deletes entram na contabilidade do período.
   */
  visaoGeral: async (
    ctx: WebContext,
    input: {
      organizacaoHash: string;
      de: string;
      ate: string;
      instanciaId?: string;
      usuarioId?: string;
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

    let atendenteIdInterno: number | null = null;
    if (input.usuarioId) {
      atendenteIdInterno = await resolverIdInterno(ctx.db, "usuario", input.usuarioId);
      if (atendenteIdInterno === null) return visaoGeralVazia;
    }

    const convWhere = [
      inArray(conversa.instanciaId, instanceIds),
      gte(conversa.criadoEm, from),
      lte(conversa.criadoEm, to),
    ];
    if (atendenteIdInterno !== null) {
      convWhere.push(eq(conversa.atribuidoUsuarioId, atendenteIdInterno));
    }

    const convRows = await ctx.db
      .select({
        id: conversa.id,
        instanciaId: conversa.instanciaId,
        contatoId: conversa.contatoId,
        status: conversa.status,
        atribuidoUsuarioId: conversa.atribuidoUsuarioId,
      })
      .from(conversa)
      .where(and(...convWhere));

    if (convRows.length === 0) {
      return {
        ...visaoGeralVazia,
        porInstancia: instanceRows.map((inst) => ({
          instanciaId: inst.uuid,
          nome: inst.nome,
          conversas: 0,
        })),
      };
    }

    const conversaIds = convRows.map((c) => c.id);
    const conversasAbertas = convRows.filter((c) => c.status === "open").length;
    const conversasFechadas = convRows.filter((c) => c.status === "closed").length;
    const totalContatos = new Set(convRows.map((c) => c.contatoId)).size;

    const [[enviadas], [recebidas]] = await Promise.all([
      ctx.db
        .select({ n: count() })
        .from(mensagem)
        .where(
          and(
            inArray(mensagem.conversaId, conversaIds),
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
            inArray(mensagem.conversaId, conversaIds),
            eq(mensagem.direcao, "inbound"),
            gte(mensagem.criadoEm, from),
            lte(mensagem.criadoEm, to),
          ),
        ),
    ]);

    const deltasPorConversa = await calcularDeltasPrimeiraResposta(ctx, conversaIds);
    const deltasTodos = [...deltasPorConversa.values()];
    const tempos = analisarTemposResposta(deltasTodos, convRows.length);

    const contatoIds = [...new Set(convRows.map((c) => c.contatoId))];
    const atribuicoes = await ctx.db
      .select({
        tagId: contatoTagAtribuicao.tagId,
        tagUuid: contatoTag.uuid,
        nome: contatoTag.nome,
        cor: contatoTag.cor,
        total: count(),
      })
      .from(contatoTagAtribuicao)
      .innerJoin(contatoTag, eq(contatoTag.id, contatoTagAtribuicao.tagId))
      .where(
        and(
          inArray(contatoTagAtribuicao.contatoId, contatoIds),
          eq(contatoTag.organizacaoId, internalOrgId),
          gte(contatoTagAtribuicao.criadoEm, from),
          lte(contatoTagAtribuicao.criadoEm, to),
        ),
      )
      .groupBy(contatoTagAtribuicao.tagId, contatoTag.uuid, contatoTag.nome, contatoTag.cor)
      .orderBy(desc(count()));

    const porItemInteresse = atribuicoes.map((a) => ({
      id: a.tagUuid,
      nome: a.nome,
      cor: a.cor,
      total: a.total,
    }));
    const itensInteresse = porItemInteresse.reduce((sum, i) => sum + i.total, 0);

    const members = await ctx.db.query.organizacaoMembro.findMany({
      where: and(
        eq(organizacaoMembro.organizacaoId, internalOrgId),
        isNull(organizacaoMembro.excluidoEm),
      ),
      columns: { usuarioId: true },
      with: { usuario: incluirUsuarioRelacao },
    });

    const enviadasPorAgente = await ctx.db
      .select({
        usuarioId: mensagem.enviadoPorUsuarioId,
        n: count(),
      })
      .from(mensagem)
      .where(
        and(
          inArray(mensagem.conversaId, conversaIds),
          eq(mensagem.direcao, "outbound"),
          gte(mensagem.criadoEm, from),
          lte(mensagem.criadoEm, to),
        ),
      )
      .groupBy(mensagem.enviadoPorUsuarioId);

    const enviadasMap = new Map(
      enviadasPorAgente
        .filter((r): r is typeof r & { usuarioId: number } => r.usuarioId != null)
        .map((r) => [r.usuarioId, r.n] as const),
    );

    const porAgente = members
      .filter((member): member is typeof member & { usuario: NonNullable<typeof member.usuario> } =>
        Boolean(member.usuario),
      )
      .map((member) => {
        const atribuídas = convRows.filter((c) => c.atribuidoUsuarioId === member.usuarioId);
        const deltasAgente = atribuídas
          .map((c) => deltasPorConversa.get(c.id))
          .filter((n): n is number => n != null);
        const mediaAgente =
          deltasAgente.length === 0
            ? null
            : Math.round((deltasAgente.reduce((a, b) => a + b, 0) / deltasAgente.length) * 10) / 10;

        return {
          usuarioId: member.usuario.uuid,
          nome: member.usuario.nome,
          conversasAtribuidas: atribuídas.length,
          mensagensEnviadas: enviadasMap.get(member.usuarioId) ?? 0,
          tempoMedioPrimeiraRespostaMinutos: mediaAgente,
        };
      })
      .filter((a) => a.conversasAtribuidas > 0 || a.mensagensEnviadas > 0)
      .toSorted((a, b) => b.conversasAtribuidas - a.conversasAtribuidas);

    const porInstancia = instanceRows.map((inst) => ({
      instanciaId: inst.uuid,
      nome: inst.nome,
      conversas: convRows.filter((c) => c.instanciaId === inst.id).length,
    }));

    return {
      totalConversas: convRows.length,
      conversasAbertas,
      conversasFechadas,
      totalContatos,
      mensagensEnviadas: enviadas?.n ?? 0,
      mensagensRecebidas: recebidas?.n ?? 0,
      tempoMedioPrimeiraRespostaMinutos: tempos.media,
      tempoMedianoPrimeiraRespostaMinutos: tempos.mediana,
      conversasComResposta: tempos.comResposta,
      distribuicaoTempoResposta: tempos.distribuicao,
      itensInteresse,
      porItemInteresse,
      porAgente,
      porInstancia,
    };
  },
};
