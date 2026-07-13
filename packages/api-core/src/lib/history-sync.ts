/**
 * Processa chunk HistorySync: ingere mensagens em ordem cronológica por conversa.
 */
import {
  deveIgnorarHistorySyncChunk,
  historySyncConcluido,
  jidParaIdExterno,
  jidParaTelefone,
  parseGoHistorySyncChunk,
} from "@whasap/evolution";
import {
  comTimestampAtualizacao,
  type Db,
  instanciaEvo,
} from "@whasap/db";
import { eq } from "drizzle-orm";

import { ingerirMensagem } from "./ingestao-mensagem";

export type InstanciaParaHistorySync = {
  id: number;
  organizacaoId: number;
  uuid: string;
};

/** Atualiza progresso/status leve sem ingerir mensagens. */
export async function atualizarProgressoHistoricoSync(
  db: Db,
  instanciaId: number,
  params: {
    status?: "idle" | "requested" | "running" | "completed" | "failed";
    progress?: number | null;
    erro?: string | null;
    marcarConcluido?: boolean;
  },
): Promise<void> {
  const patch: Record<string, unknown> = {};
  if (params.status !== undefined) patch.historicoSyncStatus = params.status;
  if (params.progress !== undefined) patch.historicoSyncProgress = params.progress;
  if (params.erro !== undefined) patch.historicoSyncErro = params.erro;
  if (params.marcarConcluido) {
    patch.historicoSyncStatus = "completed";
    patch.historicoSincronizadoEm = new Date();
    patch.historicoSincronizandoEm = null;
    patch.historicoSyncErro = null;
  }
  if (Object.keys(patch).length === 0) return;

  await db
    .update(instanciaEvo)
    .set(comTimestampAtualizacao(patch as never))
    .where(eq(instanciaEvo.instanciaId, instanciaId));
}

/**
 * Ingere um chunk HistorySync já parseado (ou raw).
 * Mensagens de cada conversa são processadas em ordem cronológica, em série.
 */
export async function processarHistorySyncChunk(
  db: Db,
  instance: InstanciaParaHistorySync,
  data: Record<string, unknown>,
): Promise<{ ignorado: boolean; concluido: boolean; progress: number }> {
  const chunk = parseGoHistorySyncChunk(data);

  if (deveIgnorarHistorySyncChunk(chunk)) {
    return { ignorado: true, concluido: false, progress: chunk.progress ?? 0 };
  }

  await atualizarProgressoHistoricoSync(db, instance.id, {
    status: "running",
    progress: chunk.progress,
    erro: null,
  });

  for (const conv of chunk.conversations) {
    const idExternoLinha = jidParaIdExterno(conv.jid);
    const idExternoCanonico = conv.jid.endsWith("@g.us")
      ? conv.jid
      : `${jidParaTelefone(conv.jid)}@s.whatsapp.net`;
    const phone = jidParaTelefone(conv.jid);

    const mensagensOrdenadas = [...conv.messages].toSorted((a, b) => {
      const ta = a.timestamp?.getTime() ?? 0;
      const tb = b.timestamp?.getTime() ?? 0;
      return ta - tb;
    });

    for (const msg of mensagensOrdenadas) {
      const direcao = msg.fromMe ? "outbound" : "inbound";
      await ingerirMensagem(db, {
        instanciaId: instance.id,
        organizacaoId: instance.organizacaoId,
        phone,
        contactName: conv.nome,
        idExternoLinha,
        idExternoCanonico,
        body: msg.body,
        type: msg.type,
        externalId: msg.messageId,
        provedor: "evo",
        direcao,
        criadoEm: msg.timestamp ?? undefined,
        ultimaMensagemEm: msg.timestamp ?? undefined,
        naoLidasInicial: conv.unreadCount,
        metadados: { origemHistorico: true, syncType: chunk.syncType },
        status: msg.status ?? (direcao === "outbound" ? "sent" : "delivered"),
      });
    }
  }

  const concluido = historySyncConcluido(chunk);
  if (concluido) {
    await atualizarProgressoHistoricoSync(db, instance.id, { marcarConcluido: true });
  }

  return { ignorado: false, concluido, progress: chunk.progress ?? 0 };
}
