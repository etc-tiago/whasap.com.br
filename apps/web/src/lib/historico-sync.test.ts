/**
 * Status/copy do sync no painel (rail + ajustes).
 */
import { describe, expect, it } from "vitest";

import {
  historicoSyncEmAndamento,
  historicoSyncStatusDe,
  rotuloHistoricoSync,
} from "./historico-sync";
import type { InstanciaItem } from "./orpc";

function inst(parcial: Partial<InstanciaItem> = {}): InstanciaItem {
  return {
    id: "00000000-0000-4000-8000-000000000001",
    organizacaoId: "00000000-0000-4000-8000-000000000002",
    nome: "Teste",
    icone: "MessageCircle",
    provider: "evo",
    status: "connected",
    limiteConversas: 1000,
    asaasSubscriptionId: null,
    cloudPhoneNumberId: null,
    trialEndsAt: null,
    connectedAt: null,
    sessaoRemotaLiberadaEm: null,
    criadoEm: "2026-01-01T00:00:00.000Z",
    ...parcial,
  } as InstanciaItem;
}

describe("historicoSyncStatusDe", () => {
  it("1) requested explicito", () => {
    expect(historicoSyncStatusDe(inst({ evoHistoricoSyncStatus: "requested" }))).toBe("requested");
  });

  it("2) running explicito", () => {
    expect(historicoSyncStatusDe(inst({ evoHistoricoSyncStatus: "running" }))).toBe("running");
  });

  it("3) completed explicito", () => {
    expect(historicoSyncStatusDe(inst({ evoHistoricoSyncStatus: "completed" }))).toBe("completed");
  });

  it("4) failed explicito", () => {
    expect(historicoSyncStatusDe(inst({ evoHistoricoSyncStatus: "failed" }))).toBe("failed");
  });

  it("5) idle explicito", () => {
    expect(historicoSyncStatusDe(inst({ evoHistoricoSyncStatus: "idle" }))).toBe("idle");
  });

  it("6) heartbeat recente sem status => running", () => {
    expect(
      historicoSyncStatusDe(
        inst({
          evoHistoricoSyncStatus: undefined,
          evoHistoricoSincronizandoEm: new Date().toISOString(),
        }),
      ),
    ).toBe("running");
  });

  it("7) heartbeat antigo (>30min) + sincronizadoEm => completed", () => {
    const antigo = new Date(Date.now() - 31 * 60 * 1000).toISOString();
    expect(
      historicoSyncStatusDe(
        inst({
          evoHistoricoSyncStatus: undefined,
          evoHistoricoSincronizandoEm: antigo,
          evoHistoricoSincronizadoEm: "2026-07-01T00:00:00.000Z",
        }),
      ),
    ).toBe("completed");
  });

  it("8) so sincronizadoEm => completed", () => {
    expect(
      historicoSyncStatusDe(
        inst({
          evoHistoricoSyncStatus: undefined,
          evoHistoricoSincronizadoEm: "2026-07-01T00:00:00.000Z",
        }),
      ),
    ).toBe("completed");
  });

  it("9) sem campos => idle", () => {
    expect(historicoSyncStatusDe(inst())).toBe("idle");
  });

  it("10) status failed tem prioridade sobre sincronizadoEm", () => {
    expect(
      historicoSyncStatusDe(
        inst({
          evoHistoricoSyncStatus: "failed",
          evoHistoricoSincronizadoEm: "2026-07-01T00:00:00.000Z",
          evoHistoricoSyncErro: "boom",
        }),
      ),
    ).toBe("failed");
  });
});

describe("historicoSyncEmAndamento", () => {
  it("11) requested = true", () => {
    expect(historicoSyncEmAndamento(inst({ evoHistoricoSyncStatus: "requested" }))).toBe(true);
  });

  it("12) running = true", () => {
    expect(historicoSyncEmAndamento(inst({ evoHistoricoSyncStatus: "running" }))).toBe(true);
  });

  it("13) completed = false", () => {
    expect(historicoSyncEmAndamento(inst({ evoHistoricoSyncStatus: "completed" }))).toBe(false);
  });

  it("14) failed = false", () => {
    expect(historicoSyncEmAndamento(inst({ evoHistoricoSyncStatus: "failed" }))).toBe(false);
  });

  it("15) idle = false", () => {
    expect(historicoSyncEmAndamento(inst({ evoHistoricoSyncStatus: "idle" }))).toBe(false);
  });
});

describe("rotuloHistoricoSync", () => {
  it("16) requested", () => {
    expect(rotuloHistoricoSync(inst({ evoHistoricoSyncStatus: "requested" }))).toBe(
      "Aguardando histórico…",
    );
  });

  it("17) running", () => {
    expect(rotuloHistoricoSync(inst({ evoHistoricoSyncStatus: "running" }))).toBe(
      "Sincronizando histórico…",
    );
  });

  it("18) completed", () => {
    expect(rotuloHistoricoSync(inst({ evoHistoricoSyncStatus: "completed" }))).toBe(
      "Histórico sincronizado",
    );
  });

  it("19) failed sem erro", () => {
    expect(rotuloHistoricoSync(inst({ evoHistoricoSyncStatus: "failed" }))).toBe(
      "Falha na sincronização",
    );
  });

  it("20) failed com erro inclui mensagem", () => {
    expect(
      rotuloHistoricoSync(
        inst({
          evoHistoricoSyncStatus: "failed",
          evoHistoricoSyncErro: "Failed query: update conversa",
        }),
      ),
    ).toBe("Falha na sincronização: Failed query: update conversa");
  });

  it("21) failed com erro so espacos = generico", () => {
    expect(
      rotuloHistoricoSync(inst({ evoHistoricoSyncStatus: "failed", evoHistoricoSyncErro: "   " })),
    ).toBe("Falha na sincronização");
  });

  it("22) idle", () => {
    expect(rotuloHistoricoSync(inst())).toBe("Histórico não sincronizado");
  });

  it("23) rotulo nao inclui percentual", () => {
    const r = rotuloHistoricoSync(
      inst({ evoHistoricoSyncStatus: "running", evoHistoricoSyncProgress: 100 }),
    );
    expect(r).not.toMatch(/%/);
    expect(r).not.toContain("100");
  });

  it("24) heartbeat 29min ainda running", () => {
    const quase = new Date(Date.now() - 29 * 60 * 1000).toISOString();
    expect(
      historicoSyncStatusDe(
        inst({ evoHistoricoSyncStatus: undefined, evoHistoricoSincronizandoEm: quase }),
      ),
    ).toBe("running");
  });

  it("25) heartbeat 31min sem sincronizadoEm => idle", () => {
    const antigo = new Date(Date.now() - 31 * 60 * 1000).toISOString();
    expect(
      historicoSyncStatusDe(
        inst({ evoHistoricoSyncStatus: undefined, evoHistoricoSincronizandoEm: antigo }),
      ),
    ).toBe("idle");
  });

  it("26) requested nao usa heartbeat para desligar", () => {
    const antigo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    expect(
      historicoSyncStatusDe(
        inst({ evoHistoricoSyncStatus: "requested", evoHistoricoSincronizandoEm: antigo }),
      ),
    ).toBe("requested");
    expect(
      historicoSyncEmAndamento(
        inst({ evoHistoricoSyncStatus: "requested", evoHistoricoSincronizandoEm: antigo }),
      ),
    ).toBe(true);
  });

  it("27) failed com erro WhatsApp rate-limit na copy", () => {
    const r = rotuloHistoricoSync(
      inst({
        evoHistoricoSyncStatus: "failed",
        evoHistoricoSyncErro:
          "O WhatsApp recusou uma nova sincronização completa agora (já houve sync recente neste aparelho).",
      }),
    );
    expect(r).toContain("já houve sync recente");
  });

  it("28) progress 0 ainda e running quando status running", () => {
    expect(
      historicoSyncStatusDe(
        inst({ evoHistoricoSyncStatus: "running", evoHistoricoSyncProgress: 0 }),
      ),
    ).toBe("running");
  });

  it("29) progress 100 sozinho nao vira completed sem status", () => {
    expect(
      historicoSyncStatusDe(
        inst({
          evoHistoricoSyncStatus: undefined,
          evoHistoricoSyncProgress: 100,
        }),
      ),
    ).toBe("idle");
  });

  it("30) SQL error na copy permanece visivel (nao engole)", () => {
    const sql =
      'Failed query: update "conversa" set "ultima_mensagem_em" = $1 params: Wed Sep 18 2024';
    expect(
      rotuloHistoricoSync(inst({ evoHistoricoSyncStatus: "failed", evoHistoricoSyncErro: sql })),
    ).toContain("Failed query");
  });

  it("31) completed tem prioridade sobre heartbeat recente", () => {
    expect(
      historicoSyncStatusDe(
        inst({
          evoHistoricoSyncStatus: "completed",
          evoHistoricoSincronizandoEm: new Date().toISOString(),
        }),
      ),
    ).toBe("completed");
    expect(
      historicoSyncEmAndamento(
        inst({
          evoHistoricoSyncStatus: "completed",
          evoHistoricoSincronizandoEm: new Date().toISOString(),
        }),
      ),
    ).toBe(false);
  });

  it("32) idle explicito nao vira running por progress", () => {
    expect(
      historicoSyncStatusDe(inst({ evoHistoricoSyncStatus: "idle", evoHistoricoSyncProgress: 55 })),
    ).toBe("idle");
  });

  it("33) erro null nao acrescenta sufixo", () => {
    expect(
      rotuloHistoricoSync(inst({ evoHistoricoSyncStatus: "failed", evoHistoricoSyncErro: null })),
    ).toBe("Falha na sincronização");
  });

  it("34) idle com sincronizadoEm ausente e heartbeat ausente", () => {
    expect(
      historicoSyncStatusDe(
        inst({
          evoHistoricoSyncStatus: undefined,
          evoHistoricoSincronizandoEm: null,
          evoHistoricoSincronizadoEm: null,
        }),
      ),
    ).toBe("idle");
  });

  it("35) running explicito ignora sincronizadoEm antigo", () => {
    expect(
      historicoSyncStatusDe(
        inst({
          evoHistoricoSyncStatus: "running",
          evoHistoricoSincronizadoEm: "2020-01-01T00:00:00.000Z",
        }),
      ),
    ).toBe("running");
  });

  it("36) titulo rail failed vs idle (copy do dialog)", () => {
    const titulo = (s: ReturnType<typeof historicoSyncStatusDe>) =>
      s === "failed" ? "Tentar sincronizar de novo?" : "Sincronizar histórico?";
    expect(titulo(historicoSyncStatusDe(inst({ evoHistoricoSyncStatus: "failed" })))).toBe(
      "Tentar sincronizar de novo?",
    );
    expect(titulo(historicoSyncStatusDe(inst()))).toBe("Sincronizar histórico?");
  });

  it("37) botao acao failed vs idle", () => {
    const acao = (s: ReturnType<typeof historicoSyncStatusDe>) =>
      s === "failed" ? "Tentar de novo" : "Sincronizar";
    expect(acao(historicoSyncStatusDe(inst({ evoHistoricoSyncStatus: "failed" })))).toBe(
      "Tentar de novo",
    );
    expect(acao(historicoSyncStatusDe(inst({ evoHistoricoSyncStatus: "running" })))).toBe(
      "Sincronizar",
    );
  });

  it("38) polling ativo quando requested ou running", () => {
    const precisaPoll = (i: InstanciaItem) => historicoSyncEmAndamento(i);
    expect(precisaPoll(inst({ evoHistoricoSyncStatus: "requested" }))).toBe(true);
    expect(precisaPoll(inst({ evoHistoricoSyncStatus: "running" }))).toBe(true);
    expect(precisaPoll(inst({ evoHistoricoSyncStatus: "completed" }))).toBe(false);
    expect(precisaPoll(inst({ evoHistoricoSyncStatus: "failed" }))).toBe(false);
  });

  it("39) meta_cloud sempre idle (sem campos evo)", () => {
    expect(
      historicoSyncStatusDe(
        inst({
          provider: "meta_cloud",
          evoHistoricoSyncStatus: undefined,
          evoHistoricoSincronizandoEm: null,
          evoHistoricoSincronizadoEm: null,
        }),
      ),
    ).toBe("idle");
    expect(
      historicoSyncEmAndamento(
        inst({
          provider: "meta_cloud",
          evoHistoricoSyncStatus: "running",
        }),
      ),
    ).toBe(true);
  });

  it("40) progress da API nao aparece no rotulo (nao engana fases)", () => {
    expect(
      rotuloHistoricoSync(
        inst({ evoHistoricoSyncStatus: "running", evoHistoricoSyncProgress: 100 }),
      ),
    ).toBe("Sincronizando histórico…");
    expect(
      rotuloHistoricoSync(
        inst({ evoHistoricoSyncStatus: "requested", evoHistoricoSyncProgress: 42 }),
      ),
    ).toBe("Aguardando histórico…");
  });

  it("41) status bogus vira idle no painel", () => {
    expect(historicoSyncStatusDe(inst({ evoHistoricoSyncStatus: "bogus" as never }))).toBe("idle");
  });

  it("42) failed com erro longo preserva texto no rotulo", () => {
    const erro = "O WhatsApp recusou uma nova sincronização completa agora (já houve sync recente)";
    expect(
      rotuloHistoricoSync(inst({ evoHistoricoSyncStatus: "failed", evoHistoricoSyncErro: erro })),
    ).toContain("recusou");
  });
});
