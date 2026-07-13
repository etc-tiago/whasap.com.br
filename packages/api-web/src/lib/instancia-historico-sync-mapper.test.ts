/**
 * Campos de historico sync no mapper de instancia (API web → painel).
 */
import { describe, expect, it } from "vitest";

import type { InstanciaComProvedor } from "./instancia-provedor";
import { toInstanciaOutput } from "./mappers";

function instancia(parcial: Partial<InstanciaComProvedor> = {}): InstanciaComProvedor {
  return {
    id: 1,
    uuid: "00000000-0000-4000-8000-000000000001",
    organizacaoId: 2,
    nome: "Clinica",
    icone: "MessageCircle",
    provedor: "evo",
    status: "connected",
    limiteConversas: 1000,
    conectadoEm: new Date("2026-01-01"),
    sessaoRemotaLiberadaEm: null,
    criadoEm: new Date("2026-01-01"),
    tentativasProvisionamento: 0,
    evo: {
      nomeInstancia: "x",
      instanceId: "y",
      token: "tok",
      historicoSincronizadoEm: null,
      historicoSincronizandoEm: null,
      historicoSyncStatus: "idle",
      historicoSyncProgress: null,
      historicoSyncErro: null,
    },
    metaCloud: null,
    ...parcial,
  };
}

describe("toInstanciaOutput — historico sync", () => {
  it("1) status running preservado", () => {
    const out = toInstanciaOutput(
      instancia({
        evo: { ...instancia().evo!, historicoSyncStatus: "running", historicoSyncProgress: 40 },
      }),
      "org-uuid",
    );
    expect(out.evoHistoricoSyncStatus).toBe("running");
    expect(out.evoHistoricoSyncProgress).toBe(40);
  });

  it("2) status desconhecido vira idle", () => {
    const out = toInstanciaOutput(
      instancia({ evo: { ...instancia().evo!, historicoSyncStatus: "bogus" } }),
      "org-uuid",
    );
    expect(out.evoHistoricoSyncStatus).toBe("idle");
  });

  it("3) null/undefined evo => campos null e idle", () => {
    const out = toInstanciaOutput(instancia({ evo: null }), "org-uuid");
    expect(out.evoHistoricoSyncStatus).toBe("idle");
    expect(out.evoHistoricoSincronizadoEm).toBeNull();
    expect(out.evoHistoricoSincronizandoEm).toBeNull();
    expect(out.evoHistoricoSyncErro).toBeNull();
  });

  it("4) failed com erro preserva string", () => {
    const out = toInstanciaOutput(
      instancia({
        evo: {
          ...instancia().evo!,
          historicoSyncStatus: "failed",
          historicoSyncErro: "O WhatsApp recusou uma nova sincronização completa agora",
        },
      }),
      "org-uuid",
    );
    expect(out.evoHistoricoSyncStatus).toBe("failed");
    expect(out.evoHistoricoSyncErro).toContain("recusou");
  });

  it("5) datas ISO em sincronizadoEm e sincronizandoEm", () => {
    const sync = new Date("2026-07-13T10:00:00.000Z");
    const andamento = new Date("2026-07-13T11:00:00.000Z");
    const out = toInstanciaOutput(
      instancia({
        evo: {
          ...instancia().evo!,
          historicoSincronizadoEm: sync,
          historicoSincronizandoEm: andamento,
          historicoSyncStatus: "completed",
        },
      }),
      "org-uuid",
    );
    expect(out.evoHistoricoSincronizadoEm).toBe("2026-07-13T10:00:00.000Z");
    expect(out.evoHistoricoSincronizandoEm).toBe("2026-07-13T11:00:00.000Z");
  });

  it("6) completed explicito", () => {
    const out = toInstanciaOutput(
      instancia({
        evo: { ...instancia().evo!, historicoSyncStatus: "completed", historicoSyncProgress: 100 },
      }),
      "org-uuid",
    );
    expect(out.evoHistoricoSyncStatus).toBe("completed");
    expect(out.evoHistoricoSyncProgress).toBe(100);
  });

  it("7) requested preservado", () => {
    const out = toInstanciaOutput(
      instancia({ evo: { ...instancia().evo!, historicoSyncStatus: "requested" } }),
      "org-uuid",
    );
    expect(out.evoHistoricoSyncStatus).toBe("requested");
  });

  it("8) meta_cloud sem evo retorna idle e nulls", () => {
    const out = toInstanciaOutput(
      instancia({
        provedor: "meta_cloud",
        evo: null,
        metaCloud: { phoneNumberId: "123" } as never,
      }),
      "org-uuid",
    );
    expect(out.provider).toBe("meta_cloud");
    expect(out.evoHistoricoSyncStatus).toBe("idle");
    expect(out.evoHistoricoSyncProgress).toBeNull();
    expect(out.evoHistoricoSyncErro).toBeNull();
  });

  it("9) matriz de status conhecidos", () => {
    const statuses = ["idle", "requested", "running", "completed", "failed"] as const;
    for (const status of statuses) {
      const out = toInstanciaOutput(
        instancia({ evo: { ...instancia().evo!, historicoSyncStatus: status } }),
        "org-uuid",
      );
      expect(out.evoHistoricoSyncStatus).toBe(status);
    }
  });

  it("10) progress null explicito", () => {
    const out = toInstanciaOutput(
      instancia({ evo: { ...instancia().evo!, historicoSyncProgress: null } }),
      "org-uuid",
    );
    expect(out.evoHistoricoSyncProgress).toBeNull();
  });
});
