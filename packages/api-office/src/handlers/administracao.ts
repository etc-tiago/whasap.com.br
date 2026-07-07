import { and, count, eq, isNull, type SQL } from "drizzle-orm";
import { notFound } from "@whasap/api-core";
import {
  colunasInstanciaPublica,
  colunasOrganizacaoPublica,
  incluirOrganizacaoPublica,
  instancia,
  organizacao,
  resolverIdInterno,
  type Db,
} from "@whasap/db";

import { mapearInstanciaParaSaida, mapearOrganizacaoParaSaida } from "../lib/mappers";
import { normalizarPaginacao } from "../lib/listagem";
import type { OfficeContext } from "../types";
import { exigirAutenticacaoOffice } from "./auth-session";

/**
 * Resolve id interno da organização quando o filtro é informado.
 * @returns `undefined` se nenhum filtro; lança 404 se o hash não existir.
 */
async function resolverOrganizacaoOpcional(
  db: Db,
  organizacaoHash?: string,
): Promise<number | undefined> {
  if (!organizacaoHash) return undefined;

  const orgIdInterno = await resolverIdInterno(db, "organizacao", organizacaoHash);
  if (!orgIdInterno) notFound();
  return orgIdInterno;
}

/** Monta filtro de instâncias ativas, opcionalmente restrito a uma organização. */
function filtroInstanciasAtivas(orgIdInterno?: number): SQL | undefined {
  const ativas = isNull(instancia.excluidoEm);
  if (orgIdInterno === undefined) return ativas;
  return and(eq(instancia.organizacaoId, orgIdInterno), ativas);
}

/**
 * Busca página de instâncias não excluídas, com organização relacionada.
 */
async function buscarInstanciasAtivas(
  db: Db,
  params: { orgIdInterno?: number; limite: number; offset: number },
) {
  return db.query.instancia.findMany({
    where: filtroInstanciasAtivas(params.orgIdInterno),
    columns: colunasInstanciaPublica,
    with: { organizacao: incluirOrganizacaoPublica },
    limit: params.limite,
    offset: params.offset,
  });
}

/**
 * Conta instâncias ativas com o mesmo filtro da listagem.
 */
async function contarInstanciasAtivas(db: Db, orgIdInterno?: number) {
  const [totalRow] = await db
    .select({ value: count() })
    .from(instancia)
    .where(filtroInstanciasAtivas(orgIdInterno));
  return totalRow?.value ?? 0;
}

/**
 * Busca página de organizações não excluídas.
 */
async function buscarOrganizacoesAtivas(db: Db, params: { limite: number; offset: number }) {
  return db.query.organizacao.findMany({
    where: isNull(organizacao.excluidoEm),
    columns: colunasOrganizacaoPublica,
    limit: params.limite,
    offset: params.offset,
  });
}

/** Conta organizações ativas (sem exclusão lógica). */
async function contarOrganizacoesAtivas(db: Db) {
  const [totalRow] = await db
    .select({ value: count() })
    .from(organizacao)
    .where(isNull(organizacao.excluidoEm));
  return totalRow?.value ?? 0;
}

export const administracaoHandlers = {
  /**
   * Lista instâncias WhatsApp para administração interna.
   * Suporta paginação e filtro opcional por `organizacaoHash`.
   */
  listarInstancias: async (
    ctx: OfficeContext,
    input?: { limite?: number; offset?: number; organizacaoHash?: string },
  ) => {
    exigirAutenticacaoOffice(ctx);
    const paginacao = normalizarPaginacao(input);
    const orgIdInterno = await resolverOrganizacaoOpcional(ctx.db, input?.organizacaoHash);

    const [linhas, total] = await Promise.all([
      buscarInstanciasAtivas(ctx.db, { orgIdInterno, ...paginacao }),
      contarInstanciasAtivas(ctx.db, orgIdInterno),
    ]);

    return {
      itens: linhas.map((linha) => mapearInstanciaParaSaida(linha, linha.organizacao!.uuid)),
      total,
    };
  },

  /**
   * Retorna uma instância pelo uuid público (`instanciaId`).
   * Inclui dados da organização dona.
   */
  obterInstancia: async (ctx: OfficeContext, input: { instanciaId: string }) => {
    exigirAutenticacaoOffice(ctx);

    const linha = await ctx.db.query.instancia.findFirst({
      where: and(eq(instancia.uuid, input.instanciaId), isNull(instancia.excluidoEm)),
      columns: colunasInstanciaPublica,
      with: { organizacao: incluirOrganizacaoPublica },
    });
    if (!linha?.organizacao) notFound();

    return mapearInstanciaParaSaida(linha, linha.organizacao.uuid);
  },

  /**
   * Lista organizações cadastradas para administração interna.
   */
  listarOrganizacoes: async (ctx: OfficeContext, input?: { limite?: number; offset?: number }) => {
    exigirAutenticacaoOffice(ctx);
    const paginacao = normalizarPaginacao(input);

    const [linhas, total] = await Promise.all([
      buscarOrganizacoesAtivas(ctx.db, paginacao),
      contarOrganizacoesAtivas(ctx.db),
    ]);

    return {
      itens: linhas.map(mapearOrganizacaoParaSaida),
      total,
    };
  },

  /**
   * Retorna uma organização pelo uuid público (`organizacaoHash`).
   */
  obterOrganizacao: async (ctx: OfficeContext, input: { organizacaoHash: string }) => {
    exigirAutenticacaoOffice(ctx);

    const org = await ctx.db.query.organizacao.findFirst({
      where: and(eq(organizacao.uuid, input.organizacaoHash), isNull(organizacao.excluidoEm)),
      columns: colunasOrganizacaoPublica,
    });
    if (!org) notFound();

    return mapearOrganizacaoParaSaida(org);
  },
};
