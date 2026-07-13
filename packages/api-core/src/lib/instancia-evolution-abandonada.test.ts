import { describe, expect, it, vi, beforeEach } from "vitest";

import {
  instanciaEvolutionEstaAbandonada,
  liberarSessaoEvolutionAbandonada,
  resolverReferenciaAbandonoEvolution,
  resolverTimeoutAbandonoMs,
  type InstanciaEvolutionAbandonadaRow,
  type InstanciaParaCriterioAbandono,
} from "./instancia-evolution-abandonada";

const agora = new Date("2026-07-11T12:00:00.000Z");
const ha40min = new Date("2026-07-11T11:20:00.000Z");
const ha10min = new Date("2026-07-11T11:50:00.000Z");
const ha4dias = new Date("2026-07-07T12:00:00.000Z");
const ha6dias = new Date("2026-07-05T12:00:00.000Z");

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
  it("never-paired pending usa criadoEm", () => {
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

  it("never-paired provisioning usa criadoEm", () => {
    const ref = resolverReferenciaAbandonoEvolution(
      base({
        status: "provisioning",
        criadoEm: ha40min,
        conectadoEm: null,
      }),
    );
    expect(ref).toEqual(ha40min);
  });

  it("já usou disconnected usa desconectadoEm", () => {
    const ref = resolverReferenciaAbandonoEvolution(
      base({
        status: "disconnected",
        conectadoEm: ha6dias,
        desconectadoEm: ha40min,
        atualizadoEm: ha10min,
      }),
    );
    expect(ref).toEqual(ha40min);
  });

  it("já usou disconnected sem desconectadoEm faz fallback para atualizadoEm", () => {
    const ref = resolverReferenciaAbandonoEvolution(
      base({
        status: "disconnected",
        conectadoEm: ha6dias,
        desconectadoEm: null,
        atualizadoEm: ha10min,
      }),
    );
    expect(ref).toEqual(ha10min);
  });

  it("já usou pending_connection (encerrarPareamento) usa atualizadoEm", () => {
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

describe("resolverTimeoutAbandonoMs / instanciaEvolutionEstaAbandonada", () => {
  it("never-paired: elegível após 30 min", () => {
    expect(resolverTimeoutAbandonoMs(base({ criadoEm: ha40min }))).toBe(30 * 60_000);
    expect(instanciaEvolutionEstaAbandonada(base({ criadoEm: ha40min }), agora, 30, 5)).toBe(true);
    expect(instanciaEvolutionEstaAbandonada(base({ criadoEm: ha10min }), agora, 30, 5)).toBe(false);
  });

  it("já usou: não elegível com 30 min / 4 dias; elegível após 5 dias", () => {
    const row4d = base({
      status: "disconnected",
      conectadoEm: ha6dias,
      desconectadoEm: ha4dias,
      atualizadoEm: ha4dias,
    });
    const row6d = base({
      status: "disconnected",
      conectadoEm: ha6dias,
      desconectadoEm: ha6dias,
      atualizadoEm: ha6dias,
    });

    expect(resolverTimeoutAbandonoMs(row4d)).toBe(5 * 24 * 60 * 60_000);
    expect(instanciaEvolutionEstaAbandonada(row4d, agora, 30, 5)).toBe(false);
    expect(instanciaEvolutionEstaAbandonada(row6d, agora, 30, 5)).toBe(true);
  });
});

const getStatus = vi.fn();
const disconnect = vi.fn(async () => undefined);
const deleteInstance = vi.fn(async () => undefined);

vi.mock("./evolution-env", () => ({
  getEvolutionCredentials: vi.fn(async () => ({
    baseUrl: "http://evo.test",
    apiKey: "key",
  })),
}));

vi.mock("./criar-cliente-evolution-go", () => ({
  criarClienteEvolutionGo: vi.fn(() => ({
    getStatus,
    disconnect,
    deleteInstance,
  })),
}));

vi.mock("./instancia-evolution", () => ({
  marcarInstanciaConectadaEvolution: vi.fn(async () => undefined),
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
    limiteConversas: 1000,
    conectadoEm: ha6dias,
    desconectadoEm: ha6dias,
    criadoEm: ha6dias,
    atualizadoEm: ha6dias,
    evo: { nomeInstancia: "loja", instanceId: "evo-1", token: "tok" },
    ...parcial,
  };
}

type FakeDb = {
  update: ReturnType<typeof vi.fn>;
  insert: ReturnType<typeof vi.fn>;
};

function criarFakeDb(): {
  db: FakeDb;
  calls: { updates: unknown[] };
} {
  const calls = { updates: [] as unknown[] };

  const chainUpdate = {
    set: vi.fn((payload: unknown) => {
      calls.updates.push(payload);
      return {
        where: vi.fn(async () => undefined),
      };
    }),
  };

  const db: FakeDb = {
    update: vi.fn(() => chainUpdate),
    insert: vi.fn(),
  };

  return { db, calls };
}

describe("liberarSessaoEvolutionAbandonada", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getStatus.mockResolvedValue({ data: { Connected: false, LoggedIn: false } });
  });

  it("libera sessão sem soft-delete nem reincarnar; seta sessaoRemotaLiberadaEm", async () => {
    const { db, calls } = criarFakeDb();
    const { marcarInstanciaConectadaEvolution } = await import("./instancia-evolution");

    const resultado = await liberarSessaoEvolutionAbandonada(
      db as never,
      {} as never,
      rowAbandonada(),
    );

    expect(resultado.remarcadaConnected).toBe(false);
    expect(resultado.instanciaId).toBe(10);
    expect(db.insert).not.toHaveBeenCalled();
    expect(marcarInstanciaConectadaEvolution).not.toHaveBeenCalled();
    expect(disconnect).toHaveBeenCalled();
    expect(deleteInstance).toHaveBeenCalled();

    const limpaCreds = calls.updates.find(
      (u) => u && typeof u === "object" && "token" in u && (u as { token: unknown }).token === null,
    );
    expect(limpaCreds).toBeTruthy();

    const liberaPainel = calls.updates.find(
      (u) => u && typeof u === "object" && "sessaoRemotaLiberadaEm" in u,
    ) as { sessaoRemotaLiberadaEm: Date; status: string; excluidoEm?: unknown } | undefined;
    expect(liberaPainel?.status).toBe("disconnected");
    expect(liberaPainel?.sessaoRemotaLiberadaEm).toBeInstanceOf(Date);
    expect(liberaPainel && "excluidoEm" in liberaPainel).toBe(false);
    expect(limpaCreds && "historicoSincronizadoEm" in (limpaCreds as object)).toBe(false);
  });

  it("never-paired volta para pending_connection", async () => {
    const { db, calls } = criarFakeDb();
    await liberarSessaoEvolutionAbandonada(
      db as never,
      {} as never,
      rowAbandonada({
        status: "pending_connection",
        conectadoEm: null,
      }),
    );

    const liberaPainel = calls.updates.find(
      (u) => u && typeof u === "object" && "sessaoRemotaLiberadaEm" in u,
    ) as { status: string } | undefined;
    expect(liberaPainel?.status).toBe("pending_connection");
  });

  it("se remoto ainda open, remarca connected e não deleta", async () => {
    getStatus.mockResolvedValue({ data: { Connected: true, LoggedIn: true } });
    const { db, calls } = criarFakeDb();
    const { marcarInstanciaConectadaEvolution } = await import("./instancia-evolution");

    const resultado = await liberarSessaoEvolutionAbandonada(
      db as never,
      {} as never,
      rowAbandonada(),
    );

    expect(resultado.remarcadaConnected).toBe(true);
    expect(marcarInstanciaConectadaEvolution).toHaveBeenCalled();
    expect(disconnect).not.toHaveBeenCalled();
    expect(deleteInstance).not.toHaveBeenCalled();
    expect(
      calls.updates.some((u) => u && typeof u === "object" && "sessaoRemotaLiberadaEm" in u),
    ).toBe(false);
  });
});
