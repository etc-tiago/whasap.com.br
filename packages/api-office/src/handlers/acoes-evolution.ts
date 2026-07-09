import { notFound } from "@whasap/api-core";
import { and, eq, isNull } from "drizzle-orm";
import { colunasInstanciaOperacao, instancia, type Db } from "@whasap/db";

import { normalizarPaginacao } from "../lib/listagem";
import type { OfficeContext } from "../types";
import { exigirAutenticacaoOffice } from "./auth-session";

async function buscarInstanciaOperacao(db: Db, instanciaUuid: string) {
  return db.query.instancia.findFirst({
    where: and(eq(instancia.uuid, instanciaUuid), isNull(instancia.excluidoEm)),
    columns: colunasInstanciaOperacao,
  });
}

function extrairTipoDaChave(key: string): string | null {
  const parts = key.split("/");
  // acao/{instanciaUuid}/{tipo}/{date}/{HH-mm-ss}.{uuid}.json ou acao/{tipo}/{date}/...
  if (parts[0] !== "acao" || parts.length < 4) return null;
  if (parts.length >= 5) return parts[2] ?? null;
  return parts[1] ?? null;
}

export const acoesEvolutionHandlers = {
  /** Lista logs R2 `acao/{instanciaUuid}/...` de chamadas Evolution outbound. */
  lista: async (
    ctx: OfficeContext,
    input: { instanciaId: string; limite?: number; cursor?: string },
  ) => {
    exigirAutenticacaoOffice(ctx);
    const row = await buscarInstanciaOperacao(ctx.db, input.instanciaId);
    if (!row) notFound();

    const paginacao = normalizarPaginacao(input);
    const prefix = `acao/${input.instanciaId}/`;
    const listed = await ctx.env.R2.list({
      prefix,
      limit: paginacao.limite,
      cursor: input.cursor,
    });

    return {
      itens: listed.objects.map((obj) => ({
        chave: obj.key,
        tipo: extrairTipoDaChave(obj.key),
        tamanho: obj.size,
        gravadoEm: obj.uploaded.toISOString(),
      })),
      total: listed.objects.length,
      cursor: listed.truncated ? listed.cursor : null,
    };
  },

  /** Retorna conteúdo JSON de um log `acao/...` no R2. */
  obter: async (ctx: OfficeContext, input: { chave: string }) => {
    exigirAutenticacaoOffice(ctx);
    if (!input.chave.startsWith("acao/")) notFound();

    const object = await ctx.env.R2.get(input.chave);
    if (!object) notFound();

    let conteudo: unknown;
    try {
      conteudo = JSON.parse(await object.text());
    } catch {
      conteudo = await object.text();
    }

    return {
      chave: input.chave,
      conteudo,
    };
  },
};
