/**
 * Simula decisoes do webhook enfileirarHistorySyncGo (puro, sem R2/queue).
 */
import { describe, expect, it } from "vitest";
import { HISTORY_SYNC_TYPE } from "@whasap/evolution";

import {
  decidirAcaoHistorySyncEnqueue,
  montarChaveR2HistoricoSync,
  montarPatchProgressoHistoricoSync,
} from "./history-sync";

type AcaoWebhook =
  | { tipo: "ignorar"; patch: Record<string, unknown> | null }
  | { tipo: "falha_sem_fila"; patch: Record<string, unknown> }
  | { tipo: "enfileirar"; r2Key: string; patchAposFila: Record<string, unknown> | null };

function simularWebhookHistorySync(
  chunk: { syncType: number; temMensagens: boolean; progress: number | null },
  opts: { temFila: boolean; instanciaUuid: string; dia: string; r2Id?: string },
): AcaoWebhook {
  const onDemand = chunk.syncType === HISTORY_SYNC_TYPE.ON_DEMAND;
  const acao = decidirAcaoHistorySyncEnqueue(chunk, opts.temFila);

  if (acao.tipo === "ignorar") {
    const patch = acao.atualizarProgresso
      ? montarPatchProgressoHistoricoSync({
          status: "running",
          progress: chunk.progress,
        })
      : null;
    return { tipo: "ignorar", patch };
  }

  if (acao.tipo === "falha_sem_fila") {
    return {
      tipo: "falha_sem_fila",
      patch: montarPatchProgressoHistoricoSync({
        status: "failed",
        erro: "Fila HISTORY_SYNC_QUEUE não configurada",
      })!,
    };
  }

  const r2Key = montarChaveR2HistoricoSync(opts.instanciaUuid, opts.dia, opts.r2Id ?? "chunk-1");
  const patchAposFila = onDemand
    ? null
    : montarPatchProgressoHistoricoSync({
        status: "running",
        progress: chunk.progress,
        erro: null,
        heartbeat: true,
        agora: new Date("2026-07-13T12:00:00Z"),
      });

  return { tipo: "enfileirar", r2Key, patchAposFila };
}

describe("simularWebhookHistorySync", () => {
  const uuid = "847c01d8-e12b-421d-8e81-7ab8c8844072";

  it("1) NON_BLOCKING ignora com patch running", () => {
    const r = simularWebhookHistorySync(
      { syncType: HISTORY_SYNC_TYPE.NON_BLOCKING_DATA, temMensagens: false, progress: 50 },
      { temFila: true, instanciaUuid: uuid, dia: "2026-07-13" },
    );
    expect(r.tipo).toBe("ignorar");
    if (r.tipo === "ignorar") {
      expect(r.patch).toMatchObject({ historicoSyncStatus: "running", historicoSyncProgress: 50 });
    }
  });

  it("2) RECENT util enfileira com r2Key e heartbeat", () => {
    const r = simularWebhookHistorySync(
      { syncType: HISTORY_SYNC_TYPE.RECENT, temMensagens: true, progress: 72 },
      { temFila: true, instanciaUuid: uuid, dia: "2026-07-13", r2Id: "abc" },
    );
    expect(r).toMatchObject({
      tipo: "enfileirar",
      r2Key: "historico-sync/847c01d8-e12b-421d-8e81-7ab8c8844072/2026-07-13/abc.json",
    });
    if (r.tipo === "enfileirar") {
      expect(r.patchAposFila).toMatchObject({
        historicoSyncStatus: "running",
        historicoSyncProgress: 72,
        historicoSyncErro: null,
      });
    }
  });

  it("3) RECENT sem fila marca failed", () => {
    const r = simularWebhookHistorySync(
      { syncType: HISTORY_SYNC_TYPE.RECENT, temMensagens: true, progress: 10 },
      { temFila: false, instanciaUuid: uuid, dia: "2026-07-13" },
    );
    expect(r.tipo).toBe("falha_sem_fila");
    if (r.tipo === "falha_sem_fila") {
      expect(r.patch.historicoSyncErro).toContain("HISTORY_SYNC_QUEUE");
    }
  });

  it("4) ON_DEMAND enfileira sem patch na instancia", () => {
    const r = simularWebhookHistorySync(
      { syncType: HISTORY_SYNC_TYPE.ON_DEMAND, temMensagens: true, progress: null },
      { temFila: true, instanciaUuid: uuid, dia: "2026-07-13" },
    );
    expect(r.tipo).toBe("enfileirar");
    if (r.tipo === "enfileirar") expect(r.patchAposFila).toBeNull();
  });

  it("5) ON_DEMAND sem msgs ignora sem patch", () => {
    const r = simularWebhookHistorySync(
      { syncType: HISTORY_SYNC_TYPE.ON_DEMAND, temMensagens: false, progress: null },
      { temFila: true, instanciaUuid: uuid, dia: "2026-07-13" },
    );
    expect(r).toEqual({ tipo: "ignorar", patch: null });
  });

  it("6) FULL util enfileira e marca running", () => {
    const r = simularWebhookHistorySync(
      { syncType: HISTORY_SYNC_TYPE.FULL, temMensagens: true, progress: 100 },
      { temFila: true, instanciaUuid: uuid, dia: "2026-07-13" },
    );
    expect(r.tipo).toBe("enfileirar");
    if (r.tipo === "enfileirar") {
      expect(r.patchAposFila?.historicoSyncStatus).toBe("running");
    }
  });

  it("7) chunk vazio RECENT ignora com progresso", () => {
    const r = simularWebhookHistorySync(
      { syncType: HISTORY_SYNC_TYPE.RECENT, temMensagens: false, progress: 99 },
      { temFila: true, instanciaUuid: uuid, dia: "2026-07-13" },
    );
    expect(r.tipo).toBe("ignorar");
    if (r.tipo === "ignorar") expect(r.patch?.historicoSyncProgress).toBe(99);
  });

  it("8) BOOTSTRAP sem fila marca failed", () => {
    const r = simularWebhookHistorySync(
      { syncType: HISTORY_SYNC_TYPE.INITIAL_BOOTSTRAP, temMensagens: true, progress: 50 },
      { temFila: false, instanciaUuid: uuid, dia: "2026-07-13" },
    );
    expect(r.tipo).toBe("falha_sem_fila");
  });

  it("9) ON_DEMAND sem fila ignora sem patch", () => {
    const r = simularWebhookHistorySync(
      { syncType: HISTORY_SYNC_TYPE.ON_DEMAND, temMensagens: true, progress: null },
      { temFila: false, instanciaUuid: uuid, dia: "2026-07-13" },
    );
    expect(r).toEqual({ tipo: "ignorar", patch: null });
  });

  it("10) PUSH_NAME com msgs enfileira com heartbeat", () => {
    const r = simularWebhookHistorySync(
      { syncType: HISTORY_SYNC_TYPE.PUSH_NAME, temMensagens: true, progress: null },
      { temFila: true, instanciaUuid: uuid, dia: "2026-07-13", r2Id: "push" },
    );
    expect(r.tipo).toBe("enfileirar");
    if (r.tipo === "enfileirar") {
      expect(r.r2Key).toContain("/push.json");
      expect(r.patchAposFila?.historicoSyncStatus).toBe("running");
    }
  });

  it("11) FULL sem fila marca failed", () => {
    const r = simularWebhookHistorySync(
      { syncType: HISTORY_SYNC_TYPE.FULL, temMensagens: true, progress: 80 },
      { temFila: false, instanciaUuid: uuid, dia: "2026-07-13" },
    );
    expect(r.tipo).toBe("falha_sem_fila");
  });
});

describe("truncar erro worker (contrato)", () => {
  function truncarErroWorker(erro: string): string {
    return erro.slice(0, 500);
  }

  it("8) erro curto intacto", () => {
    expect(truncarErroWorker("falha")).toBe("falha");
  });

  it("9) erro longo corta em 500", () => {
    const longo = "x".repeat(600);
    expect(truncarErroWorker(longo)).toHaveLength(500);
  });

  it("10) SQL gigante do bug ClinicaWork cabe no limite", () => {
    const sql = `Failed query: update conversa set ultima_mensagem_em = $1 params: ${"Wed Sep 18 2024 ".repeat(40)}`;
    expect(truncarErroWorker(sql).length).toBeLessThanOrEqual(500);
  });
});
