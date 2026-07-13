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

type SerieDiariaDia = {
  data: string;
  conversas: number;
  enviadas: number;
  recebidas: number;
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
  taxaFechamento: 0,
  conversasSemAtribuicao: 0,
  totalContatos: 0,
  mensagensEnviadas: 0,
  mensagensRecebidas: 0,
  mediaMensagensPorConversa: null as number | null,
  tempoMedioPrimeiraRespostaMinutos: null as number | null,
  tempoMedianoPrimeiraRespostaMinutos: null as number | null,
  tempoMedioAteFechamentoMinutos: null as number | null,
  conversasComResposta: 0,
  distribuicaoTempoResposta: distribuicaoVazia(),
  serieDiaria: [] as SerieDiariaDia[],
  porTipoMensagem: [] as Array<{ tipo: string; total: number }>,
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
    conversasFechadas: number;
    mensagensEnviadas: number;
    tempoMedioPrimeiraRespostaMinutos: number | null;
  }>,
  porInstancia: [] as Array<{
    instanciaId: string;
    nome: string;
    conversas: number;
    conversasAbertas: number;
    conversasFechadas: number;
    mensagensEnviadas: number;
    mensagensRecebidas: number;
  }>,
};

/** Chave YYYY-MM-DD no fuso local do servidor (Worker UTC). */
function chaveDia(d: Date) {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/**
 * Preenche todos os dias do intervalo com zeros e soma os eventos.
 * @returns série ordenada por data, um ponto por dia civil UTC.
 */
function montarSerieDiaria(
  de: Date,
  ate: Date,
  eventos: {
    conversas: Date[];
    enviadas: Date[];
    recebidas: Date[];
  },
): SerieDiariaDia[] {
  const mapa = new Map<string, SerieDiariaDia>();
  let diaMs = Date.UTC(de.getUTCFullYear(), de.getUTCMonth(), de.getUTCDate());
  const fimMs = Date.UTC(ate.getUTCFullYear(), ate.getUTCMonth(), ate.getUTCDate());

  while (diaMs <= fimMs) {
    const cursor = new Date(diaMs);
    const key = chaveDia(cursor);
    mapa.set(key, { data: key, conversas: 0, enviadas: 0, recebidas: 0 });
    diaMs += 24 * 60 * 60 * 1000;
  }

  for (const em of eventos.conversas) {
    const dia = mapa.get(chaveDia(em));
    if (dia) dia.conversas += 1;
  }
  for (const em of eventos.enviadas) {
    const dia = mapa.get(chaveDia(em));
    if (dia) dia.enviadas += 1;
  }
  for (const em of eventos.recebidas) {
    const dia = mapa.get(chaveDia(em));
    if (dia) dia.recebidas += 1;
  }

  return [...mapa.values()];
}

function mediaArredondada(valores: number[]): number | null {
  if (valores.length === 0) return null;
  return Math.round((valores.reduce((a, b) => a + b, 0) / valores.length) * 10) / 10;
}

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

  const media = mediaArredondada(deltasMinutos)!;

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
   * Inclui série diária e breakdowns para o dashboard de relatórios.
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
        criadoEm: conversa.criadoEm,
        fechadoEm: conversa.fechadoEm,
      })
      .from(conversa)
      .where(and(...convWhere));

    const serieVazia = montarSerieDiaria(from, to, {
      conversas: [],
      enviadas: [],
      recebidas: [],
    });

    if (convRows.length === 0) {
      return {
        ...visaoGeralVazia,
        serieDiaria: serieVazia,
        porInstancia: instanceRows.map((inst) => ({
          instanciaId: inst.uuid,
          nome: inst.nome,
          conversas: 0,
          conversasAbertas: 0,
          conversasFechadas: 0,
          mensagensEnviadas: 0,
          mensagensRecebidas: 0,
        })),
      };
    }

    const conversaIds = convRows.map((c) => c.id);
    const conversasAbertas = convRows.filter((c) => c.status === "open").length;
    const conversasFechadas = convRows.filter((c) => c.status === "closed").length;
    const conversasSemAtribuicao = convRows.filter((c) => c.atribuidoUsuarioId == null).length;
    const totalContatos = new Set(convRows.map((c) => c.contatoId)).size;
    const taxaFechamento =
      convRows.length === 0 ? 0 : Math.round((conversasFechadas / convRows.length) * 1000) / 10;

    const deltasFechamento = convRows
      .filter(
        (c): c is typeof c & { fechadoEm: Date } => c.status === "closed" && c.fechadoEm != null,
      )
      .map((c) => (c.fechadoEm.getTime() - c.criadoEm.getTime()) / 60_000)
      .filter((m) => m >= 0);
    const tempoMedioAteFechamentoMinutos = mediaArredondada(deltasFechamento);

    const msgsWhere = and(
      inArray(mensagem.conversaId, conversaIds),
      gte(mensagem.criadoEm, from),
      lte(mensagem.criadoEm, to),
    );

    const [msgRows, porTipoRows] = await Promise.all([
      ctx.db
        .select({
          conversaId: mensagem.conversaId,
          direcao: mensagem.direcao,
          criadoEm: mensagem.criadoEm,
          enviadoPorUsuarioId: mensagem.enviadoPorUsuarioId,
        })
        .from(mensagem)
        .where(msgsWhere),
      ctx.db
        .select({
          tipo: mensagem.tipo,
          n: count(),
        })
        .from(mensagem)
        .where(msgsWhere)
        .groupBy(mensagem.tipo)
        .orderBy(desc(count())),
    ]);

    const enviadas = msgRows.filter((m) => m.direcao === "outbound");
    const recebidas = msgRows.filter((m) => m.direcao === "inbound");
    const totalMsgs = enviadas.length + recebidas.length;
    const mediaMensagensPorConversa =
      convRows.length === 0 ? null : Math.round((totalMsgs / convRows.length) * 10) / 10;

    const porTipoMensagem = porTipoRows.map((r) => ({
      tipo: r.tipo,
      total: r.n,
    }));

    const serieDiaria = montarSerieDiaria(from, to, {
      conversas: convRows.map((c) => c.criadoEm),
      enviadas: enviadas.map((m) => m.criadoEm),
      recebidas: recebidas.map((m) => m.criadoEm),
    });

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

    const enviadasMap = new Map<number, number>();
    for (const m of enviadas) {
      if (m.enviadoPorUsuarioId == null) continue;
      enviadasMap.set(m.enviadoPorUsuarioId, (enviadasMap.get(m.enviadoPorUsuarioId) ?? 0) + 1);
    }

    const porAgente = members
      .filter((member): member is typeof member & { usuario: NonNullable<typeof member.usuario> } =>
        Boolean(member.usuario),
      )
      .map((member) => {
        const atribuídas = convRows.filter((c) => c.atribuidoUsuarioId === member.usuarioId);
        const fechadas = atribuídas.filter((c) => c.status === "closed").length;
        const deltasAgente = atribuídas
          .map((c) => deltasPorConversa.get(c.id))
          .filter((n): n is number => n != null);

        return {
          usuarioId: member.usuario.uuid,
          nome: member.usuario.nome,
          conversasAtribuidas: atribuídas.length,
          conversasFechadas: fechadas,
          mensagensEnviadas: enviadasMap.get(member.usuarioId) ?? 0,
          tempoMedioPrimeiraRespostaMinutos: mediaArredondada(deltasAgente),
        };
      })
      .filter((a) => a.conversasAtribuidas > 0 || a.mensagensEnviadas > 0)
      .toSorted((a, b) => b.conversasAtribuidas - a.conversasAtribuidas);

    const msgsPorInstancia = new Map<number, { enviadas: number; recebidas: number }>();
    const conversaParaInstancia = new Map(convRows.map((c) => [c.id, c.instanciaId] as const));
    for (const m of msgRows) {
      const instId = conversaParaInstancia.get(m.conversaId);
      if (instId == null) continue;
      const bucket = msgsPorInstancia.get(instId) ?? { enviadas: 0, recebidas: 0 };
      if (m.direcao === "outbound") bucket.enviadas += 1;
      else if (m.direcao === "inbound") bucket.recebidas += 1;
      msgsPorInstancia.set(instId, bucket);
    }

    const porInstancia = instanceRows.map((inst) => {
      const convs = convRows.filter((c) => c.instanciaId === inst.id);
      const msgs = msgsPorInstancia.get(inst.id) ?? { enviadas: 0, recebidas: 0 };
      return {
        instanciaId: inst.uuid,
        nome: inst.nome,
        conversas: convs.length,
        conversasAbertas: convs.filter((c) => c.status === "open").length,
        conversasFechadas: convs.filter((c) => c.status === "closed").length,
        mensagensEnviadas: msgs.enviadas,
        mensagensRecebidas: msgs.recebidas,
      };
    });

    return {
      totalConversas: convRows.length,
      conversasAbertas,
      conversasFechadas,
      taxaFechamento,
      conversasSemAtribuicao,
      totalContatos,
      mensagensEnviadas: enviadas.length,
      mensagensRecebidas: recebidas.length,
      mediaMensagensPorConversa,
      tempoMedioPrimeiraRespostaMinutos: tempos.media,
      tempoMedianoPrimeiraRespostaMinutos: tempos.mediana,
      tempoMedioAteFechamentoMinutos,
      conversasComResposta: tempos.comResposta,
      distribuicaoTempoResposta: tempos.distribuicao,
      serieDiaria,
      porTipoMensagem,
      itensInteresse,
      porItemInteresse,
      porAgente,
      porInstancia,
    };
  },
};
