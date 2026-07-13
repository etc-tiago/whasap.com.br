/**
 * Contrato planejar/fatiar ingestao HistorySync (steps curtos do Workflow).
 */
import { describe, expect, it } from "vitest";
import { HISTORY_SYNC_TYPE } from "@whasap/evolution";

import {
  contarLotesMidia,
  HISTORY_SYNC_INGEST_LOTE_TAMANHO,
  HISTORY_SYNC_MIDIA_CONCORRENCIA,
  particionarEmLotes,
  planejarHistorySyncChunk,
} from "./history-sync";

function chunkRaw(opts: {
  syncType: number;
  progress?: number | null;
  msgs?: number;
  conversations?: number;
}) {
  const nConv = opts.conversations ?? 1;
  const nMsgs = opts.msgs ?? 0;
  const conversations = Array.from({ length: nConv }, (_conv, c) => ({
    ID: `5511999${c}@s.whatsapp.net`,
    messages: Array.from({ length: nMsgs }, (_msg, i) => ({
      message: {
        key: {
          remoteJID: `5511999${c}@s.whatsapp.net`,
          fromMe: false,
          ID: `M${c}-${i}`,
        },
        message: { conversation: `msg ${c}-${i}` },
        messageTimestamp: 1_700_000_000 + i,
      },
    })),
  }));
  return {
    Data: {
      syncType: opts.syncType,
      progress: opts.progress ?? 50,
      conversations,
    },
  };
}

describe("planejarHistorySyncChunk", () => {
  it("1) NON_BLOCKING e ignorado com 0 msgs", () => {
    const p = planejarHistorySyncChunk(
      chunkRaw({ syncType: HISTORY_SYNC_TYPE.NON_BLOCKING_DATA, msgs: 0 }),
    );
    expect(p.ignorado).toBe(true);
    expect(p.totalMensagens).toBe(0);
    expect(p.marcarConcluidoAoFinal).toBe(false);
  });

  it("2) RECENT com 60 msgs → 3 lotes de 25", () => {
    const p = planejarHistorySyncChunk(
      chunkRaw({ syncType: HISTORY_SYNC_TYPE.RECENT, progress: 40, msgs: 60 }),
    );
    expect(p.ignorado).toBe(false);
    expect(p.totalMensagens).toBe(60);
    expect(Math.ceil(p.totalMensagens / HISTORY_SYNC_INGEST_LOTE_TAMANHO)).toBe(3);
    expect(p.marcarConcluidoAoFinal).toBe(false);
  });

  it("3) RECENT@100 marca concluido ao final", () => {
    const p = planejarHistorySyncChunk(
      chunkRaw({ syncType: HISTORY_SYNC_TYPE.RECENT, progress: 100, msgs: 2 }),
    );
    expect(p.marcarConcluidoAoFinal).toBe(true);
    expect(p.atualizarProgresso).toBe(true);
  });

  it("4) STATUS_V3S nao atualiza progresso da instancia", () => {
    const p = planejarHistorySyncChunk(
      chunkRaw({ syncType: HISTORY_SYNC_TYPE.PUSH_NAMES, progress: null, msgs: 5 }),
    );
    expect(p.atualizarProgresso).toBe(false);
    expect(p.marcarConcluidoAoFinal).toBe(false);
    expect(p.onDemand).toBe(true);
  });

  it("5) varias conversas somam mensagens", () => {
    const p = planejarHistorySyncChunk(
      chunkRaw({
        syncType: HISTORY_SYNC_TYPE.FULL,
        progress: 10,
        conversations: 3,
        msgs: 10,
      }),
    );
    expect(p.totalMensagens).toBe(30);
  });

  it("6) lote padrao e 25", () => {
    expect(HISTORY_SYNC_INGEST_LOTE_TAMANHO).toBe(25);
  });
});

describe("contarLotesMidia / offsets de ingestao", () => {
  it("7) 0 jobs → 0 lotes midia", () => {
    expect(contarLotesMidia(0)).toBe(0);
  });

  it("8) 1..4 jobs → 1 lote; 5 → 2", () => {
    expect(contarLotesMidia(1)).toBe(1);
    expect(contarLotesMidia(4)).toBe(1);
    expect(contarLotesMidia(5)).toBe(2);
  });

  it("9) offsets de ingestao cobrem o total sem buraco", () => {
    const total = 73;
    const offsets: number[] = [];
    let offset = 0;
    while (offset < total) {
      offsets.push(offset);
      offset = Math.min(offset + HISTORY_SYNC_INGEST_LOTE_TAMANHO, total);
    }
    expect(offsets).toEqual([0, 25, 50]);
    expect(offset).toBe(73);
  });

  it("10) particionar midia bate com contarLotesMidia", () => {
    const jobs = Array.from({ length: 9 }, (_, i) => i);
    expect(particionarEmLotes(jobs, HISTORY_SYNC_MIDIA_CONCORRENCIA)).toHaveLength(
      contarLotesMidia(9),
    );
  });
});
