/**
 * Decisao de enqueue no webhook + particionar midias no worker.
 */
import { describe, expect, it } from "vitest";
import { HISTORY_SYNC_TYPE } from "@whasap/evolution";

import {
  decidirAcaoHistorySyncEnqueue,
  deveMarcarFalhaAposTentativasFila,
  HISTORY_SYNC_FILA_MAX_TENTATIVAS,
  HISTORY_SYNC_MIDIA_CONCORRENCIA,
  montarChaveR2HistoricoSync,
  montarPatchProgressoHistoricoSync,
  particionarEmLotes,
} from "./history-sync";

describe("decidirAcaoHistorySyncEnqueue", () => {
  it("1) NON_BLOCKING ignora com progresso", () => {
    expect(
      decidirAcaoHistorySyncEnqueue(
        { syncType: HISTORY_SYNC_TYPE.NON_BLOCKING_DATA, temMensagens: false },
        true,
      ),
    ).toEqual({ tipo: "ignorar", atualizarProgresso: true });
  });

  it("2) NON_BLOCKING sem fila ainda ignora (nao falha)", () => {
    expect(
      decidirAcaoHistorySyncEnqueue(
        { syncType: HISTORY_SYNC_TYPE.NON_BLOCKING_DATA, temMensagens: true },
        false,
      ),
    ).toEqual({ tipo: "ignorar", atualizarProgresso: true });
  });

  it("3) sem mensagens ignora com progresso", () => {
    expect(
      decidirAcaoHistorySyncEnqueue(
        { syncType: HISTORY_SYNC_TYPE.RECENT, temMensagens: false },
        true,
      ),
    ).toEqual({ tipo: "ignorar", atualizarProgresso: true });
  });

  it("4) RECENT com msgs + fila = enfileirar", () => {
    expect(
      decidirAcaoHistorySyncEnqueue(
        { syncType: HISTORY_SYNC_TYPE.RECENT, temMensagens: true },
        true,
      ),
    ).toEqual({ tipo: "enfileirar" });
  });

  it("5) FULL com msgs + fila = enfileirar", () => {
    expect(
      decidirAcaoHistorySyncEnqueue({ syncType: HISTORY_SYNC_TYPE.FULL, temMensagens: true }, true),
    ).toEqual({ tipo: "enfileirar" });
  });

  it("6) BOOTSTRAP com msgs + fila = enfileirar", () => {
    expect(
      decidirAcaoHistorySyncEnqueue(
        { syncType: HISTORY_SYNC_TYPE.INITIAL_BOOTSTRAP, temMensagens: true },
        true,
      ),
    ).toEqual({ tipo: "enfileirar" });
  });

  it("7) RECENT com msgs sem fila = falha_sem_fila", () => {
    expect(
      decidirAcaoHistorySyncEnqueue(
        { syncType: HISTORY_SYNC_TYPE.RECENT, temMensagens: true },
        false,
      ),
    ).toEqual({ tipo: "falha_sem_fila" });
  });

  it("8) ON_DEMAND sem msgs ignora SEM atualizar progresso da instancia", () => {
    expect(
      decidirAcaoHistorySyncEnqueue(
        { syncType: HISTORY_SYNC_TYPE.ON_DEMAND, temMensagens: false },
        true,
      ),
    ).toEqual({ tipo: "ignorar", atualizarProgresso: false });
  });

  it("9) ON_DEMAND com msgs + fila = enfileirar", () => {
    expect(
      decidirAcaoHistorySyncEnqueue(
        { syncType: HISTORY_SYNC_TYPE.ON_DEMAND, temMensagens: true },
        true,
      ),
    ).toEqual({ tipo: "enfileirar" });
  });

  it("10) ON_DEMAND com msgs sem fila nao marca falha da instancia", () => {
    expect(
      decidirAcaoHistorySyncEnqueue(
        { syncType: HISTORY_SYNC_TYPE.ON_DEMAND, temMensagens: true },
        false,
      ),
    ).toEqual({ tipo: "ignorar", atualizarProgresso: false });
  });

  it("11) PUSH_NAME sem msgs ignora com progresso", () => {
    expect(
      decidirAcaoHistorySyncEnqueue(
        { syncType: HISTORY_SYNC_TYPE.PUSH_NAME, temMensagens: false },
        true,
      ),
    ).toEqual({ tipo: "ignorar", atualizarProgresso: true });
  });

  it("12) PUSH_NAME com msgs + fila = enfileirar", () => {
    expect(
      decidirAcaoHistorySyncEnqueue(
        { syncType: HISTORY_SYNC_TYPE.PUSH_NAME, temMensagens: true },
        true,
      ),
    ).toEqual({ tipo: "enfileirar" });
  });

  it("13) BOOTSTRAP sem fila = falha_sem_fila", () => {
    expect(
      decidirAcaoHistorySyncEnqueue(
        { syncType: HISTORY_SYNC_TYPE.INITIAL_BOOTSTRAP, temMensagens: true },
        false,
      ),
    ).toEqual({ tipo: "falha_sem_fila" });
  });

  it("14) FULL sem msgs ignora", () => {
    expect(
      decidirAcaoHistorySyncEnqueue(
        { syncType: HISTORY_SYNC_TYPE.FULL, temMensagens: false },
        true,
      ),
    ).toEqual({ tipo: "ignorar", atualizarProgresso: true });
  });
});

describe("particionarEmLotes", () => {
  it("15) concorrencia padrao e 4", () => {
    expect(HISTORY_SYNC_MIDIA_CONCORRENCIA).toBe(4);
  });

  it("13) lista vazia", () => {
    expect(particionarEmLotes([], 4)).toEqual([]);
  });

  it("14) menos que o tamanho = 1 lote", () => {
    expect(particionarEmLotes([1, 2, 3], 4)).toEqual([[1, 2, 3]]);
  });

  it("15) exatamente 4", () => {
    expect(particionarEmLotes([1, 2, 3, 4], 4)).toEqual([[1, 2, 3, 4]]);
  });

  it("16) 5 itens => 2 lotes", () => {
    expect(particionarEmLotes([1, 2, 3, 4, 5], 4)).toEqual([[1, 2, 3, 4], [5]]);
  });

  it("17) 9 itens => 3 lotes", () => {
    expect(particionarEmLotes([1, 2, 3, 4, 5, 6, 7, 8, 9], 4)).toEqual([
      [1, 2, 3, 4],
      [5, 6, 7, 8],
      [9],
    ]);
  });

  it("18) tamanho 1", () => {
    expect(particionarEmLotes(["a", "b"], 1)).toEqual([["a"], ["b"]]);
  });

  it("19) tamanho invalido (<=0) devolve um unico lote", () => {
    expect(particionarEmLotes([1, 2], 0)).toEqual([[1, 2]]);
    expect(particionarEmLotes([1, 2], -1)).toEqual([[1, 2]]);
  });

  it("20) nao muta o array original", () => {
    const src = [1, 2, 3, 4, 5];
    particionarEmLotes(src, 2);
    expect(src).toEqual([1, 2, 3, 4, 5]);
  });
});

describe("montarChaveR2HistoricoSync", () => {
  it("21) formato canonico historico-sync/{uuid}/{dia}/{id}.json", () => {
    expect(montarChaveR2HistoricoSync("abc-uuid", "2026-07-13", "fixed-id")).toBe(
      "historico-sync/abc-uuid/2026-07-13/fixed-id.json",
    );
  });

  it("22) id padrao e UUID v4", () => {
    const key = montarChaveR2HistoricoSync("u", "2026-01-01");
    expect(key).toMatch(
      /^historico-sync\/u\/2026-01-01\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.json$/,
    );
  });

  it("23) ids diferentes geram chaves diferentes", () => {
    expect(montarChaveR2HistoricoSync("u", "2026-01-01")).not.toBe(
      montarChaveR2HistoricoSync("u", "2026-01-01"),
    );
  });
});

describe("deveMarcarFalhaAposTentativasFila", () => {
  it("24) max tentativas e 5", () => {
    expect(HISTORY_SYNC_FILA_MAX_TENTATIVAS).toBe(5);
  });

  it("25) attempts 1..4 retry", () => {
    expect(deveMarcarFalhaAposTentativasFila(1)).toBe(false);
    expect(deveMarcarFalhaAposTentativasFila(4)).toBe(false);
  });

  it("26) attempts 5+ marca falha", () => {
    expect(deveMarcarFalhaAposTentativasFila(5)).toBe(true);
    expect(deveMarcarFalhaAposTentativasFila(6)).toBe(true);
  });

  it("27) attempts 0 nao marca falha", () => {
    expect(deveMarcarFalhaAposTentativasFila(0)).toBe(false);
  });
});

describe("montarPatchProgressoHistoricoSync", () => {
  const agora = new Date("2026-07-13T15:00:00.000Z");

  it("28) vazio retorna null", () => {
    expect(montarPatchProgressoHistoricoSync({})).toBeNull();
  });

  it("29) status + progress + erro", () => {
    expect(
      montarPatchProgressoHistoricoSync({
        status: "failed",
        progress: 40,
        erro: "boom",
      }),
    ).toEqual({
      historicoSyncStatus: "failed",
      historicoSyncProgress: 40,
      historicoSyncErro: "boom",
    });
  });

  it("30) heartbeat grava historicoSincronizandoEm", () => {
    expect(montarPatchProgressoHistoricoSync({ heartbeat: true, agora })).toEqual({
      historicoSincronizandoEm: agora,
    });
  });

  it("31) marcarConcluido sobrescreve status e limpa erro/heartbeat", () => {
    expect(
      montarPatchProgressoHistoricoSync({
        status: "failed",
        erro: "x",
        marcarConcluido: true,
        agora,
      }),
    ).toEqual({
      historicoSyncStatus: "completed",
      historicoSyncErro: null,
      historicoSincronizadoEm: agora,
      historicoSincronizandoEm: null,
    });
  });

  it("32) progress null e permitido (limpa)", () => {
    expect(montarPatchProgressoHistoricoSync({ progress: null })).toEqual({
      historicoSyncProgress: null,
    });
  });

  it("33) running + progress + heartbeat juntos", () => {
    expect(
      montarPatchProgressoHistoricoSync({
        status: "running",
        progress: 72,
        erro: null,
        heartbeat: true,
        agora,
      }),
    ).toEqual({
      historicoSyncStatus: "running",
      historicoSyncProgress: 72,
      historicoSyncErro: null,
      historicoSincronizandoEm: agora,
    });
  });
});
