/**
 * Backfill de mídia inbound ao abrir conversa: baixa via Evolution e grava no CDN.
 */
import {
  persistirMidiaInbound,
  resolveSessionJwtSecret,
  type JobMidiaInbound,
} from "@whasap/api-core";
import { isEvoProvider } from "@whasap/config";
import {
  colunasContatoInstancia,
  contatoInstancia,
  mensagem,
} from "@whasap/db";
import { and, eq, inArray, isNull } from "drizzle-orm";

import type { InstanciaComProvedor } from "./instancia-provedor";
import type { WebContext } from "../types";

const TIPOS_MIDIA = new Set(["image", "audio", "video", "document", "sticker"]);
const LIMITE_DOWNLOAD_SINCRONO = 8;

type MensagemLista = {
  id: number;
  uuid: string;
  direcao: string;
  tipo: string;
  corpo: string | null;
  midiaR2Chave?: string | null;
  idExterno?: string | null;
  status: string;
  templateNome: string | null;
  criadoEm: Date;
  metadados?: unknown;
  enviadoPorUsuario?: { uuid: string; nome: string } | null;
};

function waMessageDeMetadados(metadados: unknown): Record<string, unknown> | null {
  if (!metadados || typeof metadados !== "object") return null;
  const wa = (metadados as { waMessage?: unknown }).waMessage;
  if (!wa || typeof wa !== "object") return null;
  return wa as Record<string, unknown>;
}

function mimeDeWaMessage(waMessage: Record<string, unknown>): string | undefined {
  for (const key of [
    "imageMessage",
    "videoMessage",
    "audioMessage",
    "documentMessage",
    "stickerMessage",
  ] as const) {
    const part = waMessage[key] as { mimetype?: string } | undefined;
    if (part?.mimetype) return part.mimetype;
  }
  return undefined;
}

function fileNameDeWaMessage(waMessage: Record<string, unknown>): string | undefined {
  const doc = waMessage.documentMessage as { fileName?: string } | undefined;
  return doc?.fileName;
}

async function resolverHmacSecret(ctx: WebContext): Promise<string | null> {
  if (ctx.env.CDN_HMAC_SECRET) return ctx.env.CDN_HMAC_SECRET;
  if (ctx.env.WHATSAPP_CLOUD_WEBHOOK_SECRET) return ctx.env.WHATSAPP_CLOUD_WEBHOOK_SECRET;
  try {
    return await resolveSessionJwtSecret(ctx.env.WEB_SESSION_JWT_SECRET, "WEB_SESSION_JWT_SECRET");
  } catch {
    return null;
  }
}

/**
 * Para mensagens de mídia sem `midiaR2Chave`, tenta baixar agora (se houver `waMessage`)
 * e/ou dispara history sync on-demand da conversa para o worker preencher o restante.
 * @returns mapa id → midiaR2Chave atualizado.
 */
export async function garantirMidiasDaConversa(
  ctx: WebContext,
  params: {
    instance: InstanciaComProvedor;
    conversaIdInterno: number;
    contatoId: number;
    telefone: string | null;
    rows: MensagemLista[];
  },
): Promise<Map<number, string>> {
  const atualizados = new Map<number, string>();
  const pendentes = params.rows.filter(
    (m) => TIPOS_MIDIA.has(m.tipo) && !m.midiaR2Chave && m.idExterno,
  );
  if (pendentes.length === 0) return atualizados;

  if (!isEvoProvider(params.instance.provedor)) return atualizados;
  const evoToken = params.instance.evo?.token;
  if (!evoToken) return atualizados;

  const cdnR2 = ctx.env.CDN_R2;
  if (!cdnR2) return atualizados;

  const hmacSecret = await resolverHmacSecret(ctx);
  if (!hmacSecret) return atualizados;

  const ids = pendentes.map((m) => m.id);
  const comMeta =
    pendentes[0]?.metadados !== undefined
      ? pendentes
      : await ctx.db.query.mensagem.findMany({
          where: and(inArray(mensagem.id, ids), isNull(mensagem.excluidoEm)),
          columns: {
            id: true,
            direcao: true,
            tipo: true,
            idExterno: true,
            metadados: true,
          },
        });

  const vinculo = await ctx.db.query.contatoInstancia.findFirst({
    where: and(
      eq(contatoInstancia.contatoId, params.contatoId),
      eq(contatoInstancia.instanciaId, params.instance.id),
    ),
    columns: colunasContatoInstancia,
  });
  const remoteJid =
    vinculo?.idExterno ??
    (params.telefone ? `${params.telefone.replace(/\D/g, "")}@s.whatsapp.net` : null);
  if (!remoteJid) return atualizados;

  const jobs: JobMidiaInbound[] = [];
  for (const m of comMeta) {
    if (!m.idExterno) continue;
    const waMessage = waMessageDeMetadados(m.metadados);
    // Sem payload WhatsApp salvo, o download exige history sync (disparado no client).
    if (!waMessage) continue;
    jobs.push({
      provider: "evo",
      instanceUuid: params.instance.uuid,
      messageId: m.id,
      externalId: m.idExterno,
      type: m.tipo,
      instanceToken: evoToken,
      messageKey: {
        remoteJid,
        fromMe: m.direcao === "outbound",
        id: m.idExterno,
      },
      waMessage,
      mimeType: mimeDeWaMessage(waMessage),
      fileName: fileNameDeWaMessage(waMessage),
    });
  }

  const envMidia = {
    ...ctx.env,
    CDN_R2: cdnR2,
    CDN_HMAC_SECRET: hmacSecret,
  };

  const lote = jobs.slice(0, LIMITE_DOWNLOAD_SINCRONO);
  await Promise.allSettled(lote.map((job) => persistirMidiaInbound(envMidia, ctx.db, job)));

  if (lote.length > 0) {
    const refreshed = await ctx.db.query.mensagem.findMany({
      where: and(
        inArray(
          mensagem.id,
          lote.map((j) => j.messageId),
        ),
        isNull(mensagem.excluidoEm),
      ),
      columns: { id: true, midiaR2Chave: true },
    });
    for (const row of refreshed) {
      if (row.midiaR2Chave) atualizados.set(row.id, row.midiaR2Chave);
    }
  }

  return atualizados;
}

/** Indica se a mensagem ainda precisa de arquivo no CDN. */
export function mensagemPrecisaMidia(tipo: string, midiaR2Chave: string | null | undefined): boolean {
  return TIPOS_MIDIA.has(tipo) && !midiaR2Chave;
}
