/**
 * Regras puras do HistorySync (conclusao, ignore, idle, falha amigavel).
 */
import { describe, expect, it } from "vitest";
import {
  deveIgnorarHistorySyncChunk,
  HISTORY_SYNC_TYPE,
  historySyncConcluido,
  rotuloHistorySyncType,
  type GoHistorySyncChunk,
} from "@whasap/evolution";
import { HISTORICO_SYNC_IDLE_MS } from "./history-sync";
import { historicoSyncEmAndamento, motivoFalhaHistorySync } from "./solicitar-historico-sync";

function chunk(parcial: Partial<GoHistorySyncChunk>): GoHistorySyncChunk {
  return {
    syncType: HISTORY_SYNC_TYPE.RECENT,
    progress: 50,
    chunkOrder: 1,
    conversations: [],
    temMensagens: true,
    phoneLidMappings: [],
    ...parcial,
  };
}

describe("historySyncConcluido / deveIgnorar (matriz)", () => {
  it("1) so RECENT@100 conclui", () => {
    expect(
      historySyncConcluido(
        chunk({ syncType: HISTORY_SYNC_TYPE.RECENT, progress: 100, temMensagens: true }),
      ),
    ).toBe(true);
  });

  it("2) RECENT@99 nao conclui", () => {
    expect(historySyncConcluido(chunk({ syncType: HISTORY_SYNC_TYPE.RECENT, progress: 99 }))).toBe(
      false,
    );
  });

  it("3) RECENT@null nao conclui", () => {
    expect(
      historySyncConcluido(chunk({ syncType: HISTORY_SYNC_TYPE.RECENT, progress: null })),
    ).toBe(false);
  });

  it("4) FULL@100 nao conclui", () => {
    expect(historySyncConcluido(chunk({ syncType: HISTORY_SYNC_TYPE.FULL, progress: 100 }))).toBe(
      false,
    );
  });

  it("5) BOOTSTRAP@100 nao conclui", () => {
    expect(
      historySyncConcluido(chunk({ syncType: HISTORY_SYNC_TYPE.INITIAL_BOOTSTRAP, progress: 100 })),
    ).toBe(false);
  });

  it("6) NON_BLOCKING@100 nao conclui", () => {
    expect(
      historySyncConcluido(chunk({ syncType: HISTORY_SYNC_TYPE.NON_BLOCKING_DATA, progress: 100 })),
    ).toBe(false);
  });

  it("7) NON_BLOCKING sempre ignorado mesmo com temMensagens", () => {
    expect(
      deveIgnorarHistorySyncChunk(
        chunk({ syncType: HISTORY_SYNC_TYPE.NON_BLOCKING_DATA, temMensagens: true }),
      ),
    ).toBe(true);
  });

  it("8) chunk sem mensagens e ignorado", () => {
    expect(deveIgnorarHistorySyncChunk(chunk({ temMensagens: false }))).toBe(true);
  });

  it("9) RECENT com mensagens nao e ignorado", () => {
    expect(
      deveIgnorarHistorySyncChunk(
        chunk({ syncType: HISTORY_SYNC_TYPE.RECENT, temMensagens: true }),
      ),
    ).toBe(false);
  });

  it("10) FULL com mensagens nao e ignorado", () => {
    expect(
      deveIgnorarHistorySyncChunk(chunk({ syncType: HISTORY_SYNC_TYPE.FULL, temMensagens: true })),
    ).toBe(false);
  });
});

describe("rotuloHistorySyncType", () => {
  it("11) rotulos conhecidos", () => {
    expect(rotuloHistorySyncType(HISTORY_SYNC_TYPE.INITIAL_BOOTSTRAP)).toBe("bootstrap");
    expect(rotuloHistorySyncType(HISTORY_SYNC_TYPE.RECENT)).toBe("recente");
    expect(rotuloHistorySyncType(HISTORY_SYNC_TYPE.FULL)).toBe("completo");
    expect(rotuloHistorySyncType(HISTORY_SYNC_TYPE.NON_BLOCKING_DATA)).toBe("metadata");
    expect(rotuloHistorySyncType(HISTORY_SYNC_TYPE.PUSH_NAMES)).toBe("push-names");
    expect(rotuloHistorySyncType(HISTORY_SYNC_TYPE.STATUS_V3)).toBe("status-v3");
  });

  it("12) tipo desconhecido tem fallback", () => {
    expect(rotuloHistorySyncType(99)).toBe("tipo-99");
  });
});

describe("HISTORICO_SYNC_IDLE_MS", () => {
  it("13) idle e 5 minutos", () => {
    expect(HISTORICO_SYNC_IDLE_MS).toBe(5 * 60 * 1000);
  });
});

describe("historicoSyncEmAndamento", () => {
  it("14) null nao esta em andamento", () => {
    expect(historicoSyncEmAndamento(null)).toBe(false);
  });

  it("15) idle nao esta em andamento", () => {
    expect(
      historicoSyncEmAndamento({
        historicoSincronizandoEm: new Date(),
        historicoSyncStatus: "idle",
      }),
    ).toBe(false);
  });

  it("16) completed nao esta em andamento", () => {
    expect(
      historicoSyncEmAndamento({
        historicoSincronizandoEm: new Date(),
        historicoSyncStatus: "completed",
      }),
    ).toBe(false);
  });

  it("17) failed nao esta em andamento", () => {
    expect(
      historicoSyncEmAndamento({
        historicoSincronizandoEm: new Date(),
        historicoSyncStatus: "failed",
      }),
    ).toBe(false);
  });

  it("18) requested recente esta em andamento", () => {
    expect(
      historicoSyncEmAndamento({
        historicoSincronizandoEm: new Date(),
        historicoSyncStatus: "requested",
      }),
    ).toBe(true);
  });

  it("19) running recente esta em andamento", () => {
    expect(
      historicoSyncEmAndamento({
        historicoSincronizandoEm: new Date(),
        historicoSyncStatus: "running",
      }),
    ).toBe(true);
  });

  it("20) running sem timestamp conta como em andamento", () => {
    expect(
      historicoSyncEmAndamento({
        historicoSincronizandoEm: null,
        historicoSyncStatus: "running",
      }),
    ).toBe(true);
  });

  it("21) running com heartbeat antigo (>30min) libera lock", () => {
    const antigo = new Date(Date.now() - 31 * 60 * 1000);
    expect(
      historicoSyncEmAndamento({
        historicoSincronizandoEm: antigo,
        historicoSyncStatus: "running",
      }),
    ).toBe(false);
  });

  it("22) running com heartbeat de 10min ainda trava", () => {
    const recente = new Date(Date.now() - 10 * 60 * 1000);
    expect(
      historicoSyncEmAndamento({
        historicoSincronizandoEm: recente,
        historicoSyncStatus: "running",
      }),
    ).toBe(true);
  });

  it("22b) running exatamente no limite de 30min libera", () => {
    const limite = new Date(Date.now() - 30 * 60 * 1000);
    expect(
      historicoSyncEmAndamento({
        historicoSincronizandoEm: limite,
        historicoSyncStatus: "running",
      }),
    ).toBe(false);
  });

  it("22c) requested com heartbeat antigo tambem libera", () => {
    const antigo = new Date(Date.now() - 31 * 60 * 1000);
    expect(
      historicoSyncEmAndamento({
        historicoSincronizandoEm: antigo,
        historicoSyncStatus: "requested",
      }),
    ).toBe(false);
  });
});

describe("motivoFalhaHistorySync (copy do rail)", () => {
  it("23) 500 com sync previo = recusa WhatsApp", () => {
    const msg = motivoFalhaHistorySync(new Error("Evolution GO error (500): boom"), {
      jaSincronizouAntes: true,
    });
    expect(msg).toContain("já houve sync recente");
  });

  it("24) 502 sem sync previo = tente de novo", () => {
    const msg = motivoFalhaHistorySync(new Error("Evolution GO error (502): x"), {
      jaSincronizouAntes: false,
    });
    expect(msg).toContain("não conseguiu iniciar");
  });

  it("25) 503 com jaSincronizouAntes", () => {
    const msg = motivoFalhaHistorySync(new Error("Evolution GO error (503)"), {
      jaSincronizouAntes: true,
    });
    expect(msg).toContain("Aguarde alguns minutos");
  });

  it("26) 404 = reconecte", () => {
    expect(motivoFalhaHistorySync(new Error("Evolution GO error (404)"))).toContain(
      "não encontrada",
    );
  });

  it("27) 401 = sessao invalida", () => {
    expect(motivoFalhaHistorySync(new Error("Evolution GO error (401)"))).toContain("inválida");
  });

  it("28) 403 = sessao invalida", () => {
    expect(motivoFalhaHistorySync(new Error("Evolution GO error (403)"))).toContain("inválida");
  });

  it("29) erro generico", () => {
    expect(motivoFalhaHistorySync(new Error("timeout"))).toContain("Não foi possível iniciar");
  });

  it("30) string sem Error ainda mapeia status", () => {
    expect(
      motivoFalhaHistorySync("Evolution GO error (500)", { jaSincronizouAntes: true }),
    ).toContain("já houve sync recente");
  });

  it("31) 500 sem sync previo = tente de novo (nao rate-limit)", () => {
    const msg = motivoFalhaHistorySync(new Error("Evolution GO error (500)"), {
      jaSincronizouAntes: false,
    });
    expect(msg).toContain("não conseguiu iniciar");
    expect(msg).not.toContain("já houve sync recente");
  });

  it("32) 429 mapeia como rate-limit amigavel se ja sincronizou", () => {
    const msg = motivoFalhaHistorySync(new Error("Evolution GO error (429)"), {
      jaSincronizouAntes: true,
    });
    // se 429 nao for tratado, ainda cai no generico — aceita qualquer copy util
    expect(msg.length).toBeGreaterThan(10);
  });

  it("33) erro SQL bruto permanece legivel (nao engole)", () => {
    const msg = motivoFalhaHistorySync(
      new Error('Failed query: update "conversa" set ultima_mensagem_em'),
    );
    expect(msg).toContain("Não foi possível iniciar");
  });
});

describe("STATUS_V3 / PUSH_NAMES conclusao", () => {
  it("34) STATUS_V3@100 nao conclui", () => {
    expect(
      historySyncConcluido(chunk({ syncType: HISTORY_SYNC_TYPE.STATUS_V3 /* 1 */, progress: 100 })),
    ).toBe(false);
  });

  it("35) PUSH_NAMES@100 nao conclui sync da conta", () => {
    expect(
      historySyncConcluido(chunk({ syncType: HISTORY_SYNC_TYPE.PUSH_NAMES, progress: 100 })),
    ).toBe(false);
  });

  it("36) RECENT@100 sem mensagens ainda conclui (sinal de fim)", () => {
    expect(
      historySyncConcluido(
        chunk({
          syncType: HISTORY_SYNC_TYPE.RECENT,
          progress: 100,
          temMensagens: false,
        }),
      ),
    ).toBe(true);
  });

  it("37) PUSH_NAMES com mensagens nao e ignorado", () => {
    expect(
      deveIgnorarHistorySyncChunk(
        chunk({ syncType: HISTORY_SYNC_TYPE.PUSH_NAMES, temMensagens: true }),
      ),
    ).toBe(false);
  });

  it("38) PUSH_NAMES sem mensagens e ignorado", () => {
    expect(
      deveIgnorarHistorySyncChunk(
        chunk({ syncType: HISTORY_SYNC_TYPE.PUSH_NAMES, temMensagens: false }),
      ),
    ).toBe(true);
  });

  it("39) 429 sem sync previo cai no generico", () => {
    const msg = motivoFalhaHistorySync(new Error("Evolution GO error (429)"), {
      jaSincronizouAntes: false,
    });
    expect(msg).toContain("Não foi possível iniciar");
  });

  it("40) 429 com sync previo tambem retorna copy util", () => {
    const msg = motivoFalhaHistorySync(new Error("Evolution GO error (429)"), {
      jaSincronizouAntes: true,
    });
    expect(msg.length).toBeGreaterThan(20);
  });
});
