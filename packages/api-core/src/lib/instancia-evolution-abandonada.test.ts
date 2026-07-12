import { describe, expect, it, vi, beforeEach } from "vitest";

import {
  descartarInstanciaEvolutionAbandonada,
  instanciaEvolutionEstaAbandonada,
  resolverReferenciaAbandonoEvolution,
  type InstanciaEvolutionAbandonadaRow,
  type InstanciaParaCriterioAbandono,
} from "./instancia-evolution-abandonada";

const agora = new Date("2026-07-11T12:00:00.000Z");
const ha40min = new Date("2026-07-11T11:20:00.000Z");
const ha10min = new Date("2026-07-11T11:50:00.000Z");

function base(parcial: Partial<InstanciaParaCriterioAbandono>): InstanciaParaCriterioAbandono {
  return {
    status: "pending_connection",
    criadoEm: ha40min,
    atualizadoEm: ha40min,
    conectadoEm: null,
    desconectadoEm: null,
    ...parcial,
  };
}

describe("resolverReferenciaAbandonoEvolution", () => {
  it("disconnected usa desconectadoEm", () => {
    const ref = resolverReferenciaAbandonoEvolution(
      base({
        status: "disconnected",
        desconectadoEm: ha40min,
        atualizadoEm: ha10min,
      }),
    );
    expect(ref).toEqual(ha40min);
  });

  it("disconnected sem desconectadoEm faz fallback para atualizadoEm", () => {
    const ref = resolverReferenciaAbandonoEvolution(
      base({
        status: "disconnected",
        desconectadoEm: null,
        atualizadoEm: ha10min,
      }),
    );
    expect(ref).toEqual(ha10min);
  });

  it("pending_connection nunca conectada usa criadoEm", () => {
    const ref = resolverReferenciaAbandonoEvolution(
      base({
        status: "pending_connection",
        criadoEm: ha40min,
        conectadoEm: null,
        atualizadoEm: ha10min,
      }),
    );
    expect(ref).toEqual(ha40min);
  });

  it("provisioning nunca conectada usa criadoEm", () => {
    const ref = resolverReferenciaAbandonoEvolution(
      base({
        status: "provisioning",
        criadoEm: ha40min,
        conectadoEm: null,
      }),
    );
    expect(ref).toEqual(ha40min);
  });

  it("pending_connection pós-conexão (encerrarPareamento) usa atualizadoEm", () => {
    const ref = resolverReferenciaAbandonoEvolution(
      base({
        status: "pending_connection",
        criadoEm: new Date("2026-07-01T00:00:00.000Z"),
        conectadoEm: new Date("2026-07-10T00:00:00.000Z"),
        atualizadoEm: ha10min,
      }),
    );
    expect(ref).toEqual(ha10min);
  });

  it("status operacional retorna null", () => {
    expect(resolverReferenciaAbandonoEvolution(base({ status: "connected" }))).toBeNull();
    expect(resolverReferenciaAbandonoEvolution(base({ status: "pending_payment" }))).toBeNull();
    expect(resolverReferenciaAbandonoEvolution(base({ status: "deactivated" }))).toBeNull();
  });
});

describe("instanciaEvolutionEstaAbandonada", () => {
  it("true quando referência tem mais de 30 minutos", () => {
    expect(instanciaEvolutionEstaAbandonada(base({ criadoEm: ha40min }), agora, 30)).toBe(true);
  });

  it("false quando referência tem menos de 30 minutos", () => {
    expect(instanciaEvolutionEstaAbandonada(base({ criadoEm: ha10min }), agora, 30)).toBe(false);
  });

  it("disconnected legado usa atualizadoEm no critério", () => {
    expect(
      instanciaEvolutionEstaAbandonada(
        base({
          status: "disconnected",
          desconectadoEm: null,
          atualizadoEm: ha40min,
        }),
        agora,
        30,
      ),
    ).toBe(true);
    expect(
      instanciaEvolutionEstaAbandonada(
        base({
          status: "disconnected",
          desconectadoEm: null,
          atualizadoEm: ha10min,
        }),
        agora,
        30,
      ),
    ).toBe(false);
  });
});

vi.mock("./evolution-env", () => ({
  getEvolutionCredentials: vi.fn(async () => ({
    baseUrl: "http://evo.test",
    apiKey: "key",
  })),
}));

vi.mock("./criar-cliente-evolution-go", () => ({
  criarClienteEvolutionGo: vi.fn(() => ({
    disconnect: vi.fn(async () => undefined),
    deleteInstance: vi.fn(async () => undefined),
  })),
}));

function rowAbandonada(
  parcial: Partial<InstanciaEvolutionAbandonadaRow> = {},
): InstanciaEvolutionAbandonadaRow {
  return {
    id: 10,
    uuid: "11111111-1111-1111-1111-111111111111",
    organizacaoId: 1,
    nome: "Loja",
    status: "disconnected",
    asaasIdAssinatura: null,
    limiteConversas: 1000,
    trialTerminaEm: null,
    conectadoEm: null,
    desconectadoEm: ha40min,
    criadoEm: ha40min,
    atualizadoEm: ha40min,
    evo: { nomeInstancia: "loja", instanceId: "evo-1", token: "tok" },
    ...parcial,
  };
}

type FakeDb = {
  update: ReturnType<typeof vi.fn>;
  insert: ReturnType<typeof vi.fn>;
};

function criarFakeDb(opts: { reincarnadaId?: number } = {}): {
  db: FakeDb;
  calls: { updates: unknown[]; inserts: unknown[] };
} {
  const calls = { updates: [] as unknown[], inserts: [] as unknown[] };

  const chainUpdate = {
    set: vi.fn((payload: unknown) => {
      calls.updates.push(payload);
      return {
        where: vi.fn(async () => undefined),
      };
    }),
  };

  const chainInsert = {
    values: vi.fn((payload: unknown) => {
      calls.inserts.push(payload);
      return {
        returning: vi.fn(async () => [{ id: opts.reincarnadaId ?? 99 }]),
      };
    }),
  };

  const db: FakeDb = {
    update: vi.fn(() => chainUpdate),
    insert: vi.fn(() => chainInsert),
  };

  return { db, calls };
}

describe("descartarInstanciaEvolutionAbandonada", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("sem assinatura: só soft-delete", async () => {
    const { db, calls } = criarFakeDb();
    const resultado = await descartarInstanciaEvolutionAbandonada(
      db as never,
      {} as never,
      rowAbandonada({ asaasIdAssinatura: null }),
    );

    expect(resultado.reincarnadaId).toBeNull();
    expect(resultado.instanciaId).toBe(10);
    expect(db.insert).not.toHaveBeenCalled();
    expect(calls.updates.some((u) => u && typeof u === "object" && "excluidoEm" in u)).toBe(true);
  });

  it("com assinatura: null assinatura, soft-delete, recria pending_connection e move addons", async () => {
    const { db, calls } = criarFakeDb({ reincarnadaId: 77 });
    const resultado = await descartarInstanciaEvolutionAbandonada(
      db as never,
      {} as never,
      rowAbandonada({
        asaasIdAssinatura: "sub_123",
        trialTerminaEm: new Date("2026-08-01T00:00:00.000Z"),
        limiteConversas: 2000,
      }),
    );

    expect(resultado.reincarnadaId).toBe(77);
    expect(db.insert).toHaveBeenCalled();
    expect(calls.inserts[0]).toMatchObject({
      organizacaoId: 1,
      nome: "Loja",
      provedor: "evo",
      status: "pending_connection",
      asaasIdAssinatura: "sub_123",
      limiteConversas: 2000,
    });
    expect(calls.updates.some((u) => u && typeof u === "object" && "asaasIdAssinatura" in u)).toBe(
      true,
    );
    // limpa evo + null asaas + soft-delete + move addon = pelo menos 4 updates
    expect(db.update.mock.calls.length).toBeGreaterThanOrEqual(4);
  });
});
