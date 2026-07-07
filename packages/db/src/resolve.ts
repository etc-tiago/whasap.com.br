import { and, eq, inArray, isNull } from "drizzle-orm";

import { colunasIdUuid, colunasSomenteId } from "./colunas";
import type { Db } from "./client";
import {
  contato,
  conversa,
  instancia,
  organizacao,
  organizacaoConvite,
  organizacaoMembro,
  usuario,
} from "./schema";

export type NomeTabelaExportavel =
  | "usuario"
  | "organizacao"
  | "organizacaoMembro"
  | "organizacaoConvite"
  | "instancia"
  | "contato"
  | "conversa";

/**
 * Converte uuid público da API em PK serial interna.
 * @returns `number` (id interno) ou `null` se não encontrado / excluído.
 */
export async function resolverIdInterno(
  db: Db,
  tabela: NomeTabelaExportavel,
  uuidPublico: string,
): Promise<number | null> {
  switch (tabela) {
    case "usuario": {
      const linha = await db.query.usuario.findFirst({
        where: and(eq(usuario.uuid, uuidPublico), isNull(usuario.excluidoEm)),
        columns: colunasSomenteId,
      });
      return linha?.id ?? null;
    }
    case "organizacao": {
      const linha = await db.query.organizacao.findFirst({
        where: and(eq(organizacao.uuid, uuidPublico), isNull(organizacao.excluidoEm)),
        columns: colunasSomenteId,
      });
      return linha?.id ?? null;
    }
    case "organizacaoMembro": {
      const linha = await db.query.organizacaoMembro.findFirst({
        where: and(eq(organizacaoMembro.uuid, uuidPublico), isNull(organizacaoMembro.excluidoEm)),
        columns: colunasSomenteId,
      });
      return linha?.id ?? null;
    }
    case "organizacaoConvite": {
      const linha = await db.query.organizacaoConvite.findFirst({
        where: and(eq(organizacaoConvite.uuid, uuidPublico), isNull(organizacaoConvite.excluidoEm)),
        columns: colunasSomenteId,
      });
      return linha?.id ?? null;
    }
    case "instancia": {
      const linha = await db.query.instancia.findFirst({
        where: and(eq(instancia.uuid, uuidPublico), isNull(instancia.excluidoEm)),
        columns: colunasSomenteId,
      });
      return linha?.id ?? null;
    }
    case "contato": {
      const linha = await db.query.contato.findFirst({
        where: and(eq(contato.uuid, uuidPublico), isNull(contato.excluidoEm)),
        columns: colunasSomenteId,
      });
      return linha?.id ?? null;
    }
    case "conversa": {
      const linha = await db.query.conversa.findFirst({
        where: and(eq(conversa.uuid, uuidPublico), isNull(conversa.excluidoEm)),
        columns: colunasSomenteId,
      });
      return linha?.id ?? null;
    }
  }
}

/**
 * Converte vários uuids públicos em mapa uuid → id interno.
 * @returns `Map<uuid, id>` apenas para registros ativos encontrados.
 */
export async function resolverIdsInternos(
  db: Db,
  tabela: NomeTabelaExportavel,
  uuidsPublicos: string[],
): Promise<Map<string, number>> {
  if (uuidsPublicos.length === 0) return new Map();

  const unicos = [...new Set(uuidsPublicos)];

  switch (tabela) {
    case "usuario": {
      const linhas = await db.query.usuario.findMany({
        where: and(inArray(usuario.uuid, unicos), isNull(usuario.excluidoEm)),
        columns: colunasIdUuid,
      });
      return new Map(linhas.map((linha) => [linha.uuid, linha.id]));
    }
    case "organizacao": {
      const linhas = await db.query.organizacao.findMany({
        where: and(inArray(organizacao.uuid, unicos), isNull(organizacao.excluidoEm)),
        columns: colunasIdUuid,
      });
      return new Map(linhas.map((linha) => [linha.uuid, linha.id]));
    }
    case "organizacaoMembro": {
      const linhas = await db.query.organizacaoMembro.findMany({
        where: and(inArray(organizacaoMembro.uuid, unicos), isNull(organizacaoMembro.excluidoEm)),
        columns: colunasIdUuid,
      });
      return new Map(linhas.map((linha) => [linha.uuid, linha.id]));
    }
    case "organizacaoConvite": {
      const linhas = await db.query.organizacaoConvite.findMany({
        where: and(inArray(organizacaoConvite.uuid, unicos), isNull(organizacaoConvite.excluidoEm)),
        columns: colunasIdUuid,
      });
      return new Map(linhas.map((linha) => [linha.uuid, linha.id]));
    }
    case "instancia": {
      const linhas = await db.query.instancia.findMany({
        where: and(inArray(instancia.uuid, unicos), isNull(instancia.excluidoEm)),
        columns: colunasIdUuid,
      });
      return new Map(linhas.map((linha) => [linha.uuid, linha.id]));
    }
    case "contato": {
      const linhas = await db.query.contato.findMany({
        where: and(inArray(contato.uuid, unicos), isNull(contato.excluidoEm)),
        columns: colunasIdUuid,
      });
      return new Map(linhas.map((linha) => [linha.uuid, linha.id]));
    }
    case "conversa": {
      const linhas = await db.query.conversa.findMany({
        where: and(inArray(conversa.uuid, unicos), isNull(conversa.excluidoEm)),
        columns: colunasIdUuid,
      });
      return new Map(linhas.map((linha) => [linha.uuid, linha.id]));
    }
  }
}

/**
 * Extrai uuid exportável de uma linha já carregada.
 * @returns uuid público da entidade.
 */
export function exportarUuid(linha: { uuid: string }): string {
  return linha.uuid;
}

export {
  contato,
  conversa,
  instancia,
  organizacao,
  organizacaoConvite,
  organizacaoMembro,
  usuario,
};
