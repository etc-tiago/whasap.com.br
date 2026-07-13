import { forbidden, notFound, preconditionFailed } from "@whasap/api-core";
import { buildRespostaRapidaMediaR2Key, cdnMediaUrl, mimeToExtension } from "@whasap/config";
import {
  colunasOrganizacaoPublica,
  colunasRespostaRapida,
  colunasRespostaRapidaItem,
  comCriadoEm,
  comTimestampsCriacao,
  comTimestampAtualizacao,
  marcarExclusaoLogica,
  organizacao,
  respostaRapida,
  respostaRapidaItem,
} from "@whasap/db";
import { and, asc, eq, isNull } from "drizzle-orm";

import { pode } from "../lib/permissoes";
import type { MemberRole, WebContext } from "../types";
import { exigirAutenticacao, resolverMembro } from "./auth";

type TipoItem = "text" | "image" | "document";

type ItemInput = {
  tipo: TipoItem;
  corpo?: string | null;
  mediaR2Key?: string | null;
  nomeArquivo?: string | null;
};

type ItemSaida = {
  id: string;
  ordem: number;
  tipo: TipoItem;
  corpo: string | null;
  mediaR2Key: string | null;
  mediaUrl: string | null;
  nomeArquivo: string | null;
};

const LIMITE_MIDIA_BYTES = 20 * 1024 * 1024;

function verificarPodeEscreverCaixaEntrada(role: MemberRole) {
  if (!pode(role, "inbox.enviar")) forbidden();
}

function base64ParaArrayBuffer(base64: string): ArrayBuffer {
  const normalized = base64.replace(/^data:[^;]+;base64,/, "");
  const binary = atob(normalized);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}

function mimeCompativelComTipo(tipo: "image" | "document", tipoConteudo: string): boolean {
  const mime = tipoConteudo.split(";")[0]?.trim().toLowerCase() ?? "";
  if (tipo === "image") return mime.startsWith("image/");
  return mime.startsWith("application/") || mime.startsWith("text/");
}

function urlMidia(ctx: WebContext, midiaR2Chave: string | null): string | null {
  if (!midiaR2Chave || !ctx.env.CDN_URL) return null;
  return cdnMediaUrl(ctx.env.CDN_URL, midiaR2Chave);
}

function mapearItem(
  ctx: WebContext,
  item: {
    uuid: string;
    ordem: number;
    tipo: string;
    corpo: string | null;
    midiaR2Chave: string | null;
    nomeArquivo: string | null;
  },
): ItemSaida {
  return {
    id: item.uuid,
    ordem: item.ordem,
    tipo: item.tipo as TipoItem,
    corpo: item.corpo,
    mediaR2Key: item.midiaR2Chave,
    mediaUrl: urlMidia(ctx, item.midiaR2Chave),
    nomeArquivo: item.nomeArquivo,
  };
}

function validarItens(itens: ItemInput[]) {
  for (const [i, item] of itens.entries()) {
    if (item.tipo === "text") {
      if (!item.corpo?.trim()) {
        preconditionFailed(`Item ${i + 1}: texto obrigatório`);
      }
    } else if (!item.mediaR2Key?.trim()) {
      preconditionFailed(`Item ${i + 1}: mídia obrigatória`);
    }
  }
}

/**
 * Monta detalhe público da resposta rápida com itens ordenados.
 */
async function carregarDetalhe(
  ctx: WebContext,
  row: {
    id: number;
    uuid: string;
    titulo: string;
    criadoEm: Date;
    atualizadoEm: Date;
  },
) {
  const itens = await ctx.db.query.respostaRapidaItem.findMany({
    where: eq(respostaRapidaItem.respostaRapidaId, row.id),
    columns: colunasRespostaRapidaItem,
    orderBy: [asc(respostaRapidaItem.ordem)],
  });

  return {
    id: row.uuid,
    titulo: row.titulo,
    itens: itens.map((item) => mapearItem(ctx, item)),
    criadoEm: row.criadoEm.toISOString(),
    atualizadoEm: row.atualizadoEm.toISOString(),
  };
}

async function buscarRespostaAtiva(ctx: WebContext, organizacaoId: number, id: string) {
  const row = await ctx.db.query.respostaRapida.findFirst({
    where: and(
      eq(respostaRapida.uuid, id),
      eq(respostaRapida.organizacaoId, organizacaoId),
      isNull(respostaRapida.excluidoEm),
    ),
    columns: colunasRespostaRapida,
  });
  if (!row) notFound("Resposta rápida não encontrada");
  return row;
}

async function substituirItens(ctx: WebContext, respostaRapidaId: number, itens: ItemInput[]) {
  await ctx.db
    .delete(respostaRapidaItem)
    .where(eq(respostaRapidaItem.respostaRapidaId, respostaRapidaId));

  if (itens.length === 0) return;

  await ctx.db.insert(respostaRapidaItem).values(
    itens.map((item, ordem) =>
      comCriadoEm({
        respostaRapidaId,
        ordem,
        tipo: item.tipo,
        corpo: item.corpo?.trim() || null,
        midiaR2Chave: item.mediaR2Key?.trim() || null,
        nomeArquivo: item.nomeArquivo?.trim() || null,
      }),
    ),
  );
}

/**
 * CRUD de respostas rápidas (texto / imagem / documento em sequência).
 * Escrita restrita a papéis com `inbox.enviar` (admin + usuario).
 */
export const respostasRapidasHandlers = {
  /** Lista respostas ativas da org com preview do primeiro item. */
  lista: async (ctx: WebContext, input: { organizacaoHash: string }) => {
    exigirAutenticacao(ctx);
    const { role, internalOrgId } = await resolverMembro(ctx, input.organizacaoHash);
    verificarPodeEscreverCaixaEntrada(role);

    const rows = await ctx.db.query.respostaRapida.findMany({
      where: and(
        eq(respostaRapida.organizacaoId, internalOrgId),
        isNull(respostaRapida.excluidoEm),
      ),
      columns: colunasRespostaRapida,
      with: {
        itens: {
          columns: colunasRespostaRapidaItem,
          orderBy: [asc(respostaRapidaItem.ordem)],
        },
      },
      orderBy: [asc(respostaRapida.titulo)],
    });

    return rows.map((row) => {
      const itens = [...row.itens].toSorted((a, b) => a.ordem - b.ordem);
      const primeiro = itens[0];
      const preview =
        primeiro?.corpo?.trim() ||
        primeiro?.nomeArquivo ||
        (primeiro?.tipo === "image"
          ? "Imagem"
          : primeiro?.tipo === "document"
            ? "Documento"
            : null);

      return {
        id: row.uuid,
        titulo: row.titulo,
        quantidadeItens: itens.length,
        preview,
        tipos: itens.map((item) => item.tipo as TipoItem),
        criadoEm: row.criadoEm.toISOString(),
        atualizadoEm: row.atualizadoEm.toISOString(),
      };
    });
  },

  /** Detalhe com itens ordenados. */
  obter: async (ctx: WebContext, input: { organizacaoHash: string; id: string }) => {
    exigirAutenticacao(ctx);
    const { role, internalOrgId } = await resolverMembro(ctx, input.organizacaoHash);
    verificarPodeEscreverCaixaEntrada(role);

    const row = await buscarRespostaAtiva(ctx, internalOrgId, input.id);
    return carregarDetalhe(ctx, row);
  },

  /** Cria resposta rápida com ≥1 item. */
  criar: async (
    ctx: WebContext,
    input: { organizacaoHash: string; titulo: string; itens: ItemInput[] },
  ) => {
    exigirAutenticacao(ctx);
    const { role, internalOrgId } = await resolverMembro(ctx, input.organizacaoHash);
    verificarPodeEscreverCaixaEntrada(role);
    validarItens(input.itens);

    const [row] = await ctx.db
      .insert(respostaRapida)
      .values(
        comTimestampsCriacao({
          organizacaoId: internalOrgId,
          titulo: input.titulo.trim(),
        }),
      )
      .returning({
        id: respostaRapida.id,
        uuid: respostaRapida.uuid,
        titulo: respostaRapida.titulo,
        criadoEm: respostaRapida.criadoEm,
        atualizadoEm: respostaRapida.atualizadoEm,
      });

    if (!row) preconditionFailed("Não foi possível criar a resposta rápida");

    await substituirItens(ctx, row.id, input.itens);
    return carregarDetalhe(ctx, row);
  },

  /** Atualiza título e substitui itens. */
  atualizar: async (
    ctx: WebContext,
    input: {
      organizacaoHash: string;
      id: string;
      titulo: string;
      itens: ItemInput[];
    },
  ) => {
    exigirAutenticacao(ctx);
    const { role, internalOrgId } = await resolverMembro(ctx, input.organizacaoHash);
    verificarPodeEscreverCaixaEntrada(role);
    validarItens(input.itens);

    const existente = await buscarRespostaAtiva(ctx, internalOrgId, input.id);

    const [row] = await ctx.db
      .update(respostaRapida)
      .set(
        comTimestampAtualizacao({
          titulo: input.titulo.trim(),
        }),
      )
      .where(eq(respostaRapida.id, existente.id))
      .returning({
        id: respostaRapida.id,
        uuid: respostaRapida.uuid,
        titulo: respostaRapida.titulo,
        criadoEm: respostaRapida.criadoEm,
        atualizadoEm: respostaRapida.atualizadoEm,
      });

    if (!row) notFound("Resposta rápida não encontrada");

    await substituirItens(ctx, row.id, input.itens);
    return carregarDetalhe(ctx, row);
  },

  /** Soft-delete da resposta rápida. */
  excluir: async (ctx: WebContext, input: { organizacaoHash: string; id: string }) => {
    exigirAutenticacao(ctx);
    const { role, internalOrgId } = await resolverMembro(ctx, input.organizacaoHash);
    verificarPodeEscreverCaixaEntrada(role);

    const existente = await buscarRespostaAtiva(ctx, internalOrgId, input.id);

    await ctx.db
      .update(respostaRapida)
      .set(comTimestampAtualizacao(marcarExclusaoLogica()))
      .where(eq(respostaRapida.id, existente.id));

    return { ok: true };
  },

  midia: {
    /**
     * Upload de imagem/documento para cadastro de respostas rápidas (escopo org).
     * @returns Chave R2 e URL pública CDN.
     */
    upload: async (
      ctx: WebContext,
      input: {
        organizacaoHash: string;
        tipo: "image" | "document";
        nomeArquivo: string;
        tipoConteudo: string;
        dados: string;
      },
    ) => {
      exigirAutenticacao(ctx);
      const { role, internalOrgId } = await resolverMembro(ctx, input.organizacaoHash);
      verificarPodeEscreverCaixaEntrada(role);

      if (!ctx.env.R2 && !ctx.env.CDN_R2) {
        preconditionFailed("Armazenamento de mídia não configurado");
      }
      if (!mimeCompativelComTipo(input.tipo, input.tipoConteudo)) {
        preconditionFailed("Tipo de arquivo incompatível com o anexo selecionado");
      }

      const org = await ctx.db.query.organizacao.findFirst({
        where: eq(organizacao.id, internalOrgId),
        columns: colunasOrganizacaoPublica,
      });
      if (!org) notFound();

      const buffer = base64ParaArrayBuffer(input.dados);
      if (buffer.byteLength > LIMITE_MIDIA_BYTES) {
        preconditionFailed("Arquivo muito grande (máx. 20 MB)");
      }
      if (buffer.byteLength === 0) preconditionFailed("Arquivo vazio");

      const ext = mimeToExtension(input.tipoConteudo, input.nomeArquivo);
      const r2Key = buildRespostaRapidaMediaR2Key(org.uuid, ext);
      const bucket = ctx.env.CDN_R2 ?? ctx.env.R2;
      if (!bucket) preconditionFailed("Storage de mídia não configurado");

      await bucket.put(r2Key, buffer, {
        httpMetadata: { contentType: input.tipoConteudo.split(";")[0]?.trim() },
      });

      if (!ctx.env.CDN_URL) preconditionFailed("CDN não configurado");

      return {
        mediaR2Key: r2Key,
        mediaUrl: cdnMediaUrl(ctx.env.CDN_URL, r2Key),
      };
    },
  },
};
