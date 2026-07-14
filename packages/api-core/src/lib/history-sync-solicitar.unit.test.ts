/**
 * solicitarHistoricoSync* com cliente Evolution mockado.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const getStatus = vi.fn();
const historySync = vi.fn();

vi.mock("./criar-cliente-evolution-go", () => ({
  criarClienteEvolutionGo: () => ({ getStatus, historySync }),
}));

vi.mock("./evolution-env", () => ({
  getEvolutionCredentials: vi
    .fn()
    .mockResolvedValue({ url: "https://evo.test", globalApiKey: "k" }),
}));

const updates: Array<Record<string, unknown>> = [];

function dbMock(queryHandlers: Record<string, () => Promise<unknown>> = {}) {
  return {
    query: {
      instanciaEvo: {
        findFirst: queryHandlers.instanciaEvo ?? (async () => null),
      },
      contatoInstancia: {
        findFirst: queryHandlers.contatoInstancia ?? (async () => null),
      },
      mensagem: {
        findFirst: queryHandlers.mensagem ?? (async () => null),
      },
    },
    update: () => ({
      set: (patch: Record<string, unknown>) => {
        updates.push(patch);
        return { where: async () => undefined };
      },
    }),
  };
}

const instanciaBase = {
  id: 10,
  uuid: "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee",
  evo: {
    token: "evo-token",
    historicoSincronizadoEm: null as Date | null,
    historicoSincronizandoEm: null as Date | null,
    historicoSyncStatus: null as string | null,
  },
};

async function load() {
  return import("./solicitar-historico-sync");
}

describe("solicitarHistoricoSyncEvolution", () => {
  beforeEach(() => {
    getStatus.mockReset();
    historySync.mockReset();
    updates.length = 0;
    getStatus.mockResolvedValue({ state: "open" });
    historySync.mockResolvedValue(undefined);
  });

  it("1) sem token retorna erro", async () => {
    const { solicitarHistoricoSyncEvolution } = await load();
    const r = await solicitarHistoricoSyncEvolution(dbMock() as never, {} as never, {
      ...instanciaBase,
      evo: { ...instanciaBase.evo!, token: null },
    });
    expect(r).toEqual({ ok: false, motivo: "Instância Evolution sem token" });
  });

  it("2) em andamento bloqueia sem forcar", async () => {
    const { solicitarHistoricoSyncEvolution } = await load();
    const r = await solicitarHistoricoSyncEvolution(dbMock() as never, {} as never, {
      ...instanciaBase,
      evo: {
        ...instanciaBase.evo!,
        historicoSyncStatus: "running",
        historicoSincronizandoEm: new Date(),
      },
    });
    expect(r.ok).toBe(false);
    expect(r.motivo).toContain("em andamento");
    expect(historySync).not.toHaveBeenCalled();
  });

  it("3) forcar ignora lock em andamento", async () => {
    const { solicitarHistoricoSyncEvolution } = await load();
    const r = await solicitarHistoricoSyncEvolution(
      dbMock() as never,
      {} as never,
      {
        ...instanciaBase,
        evo: {
          ...instanciaBase.evo!,
          historicoSyncStatus: "running",
          historicoSincronizandoEm: new Date(),
        },
      },
      { forcar: true },
    );
    expect(r.ok).toBe(true);
    expect(historySync).toHaveBeenCalledWith({ count: 5000 });
  });

  it("4) sessao offline nao chama historySync", async () => {
    getStatus.mockResolvedValue({ state: "connecting" });
    const { solicitarHistoricoSyncEvolution } = await load();
    const r = await solicitarHistoricoSyncEvolution(dbMock() as never, {} as never, instanciaBase);
    expect(r.ok).toBe(false);
    expect(r.motivo).toContain("conectada");
    expect(historySync).not.toHaveBeenCalled();
  });

  it("5) getStatus falha retorna motivo de preflight", async () => {
    getStatus.mockRejectedValue(new Error("timeout"));
    const { solicitarHistoricoSyncEvolution } = await load();
    const r = await solicitarHistoricoSyncEvolution(dbMock() as never, {} as never, instanciaBase);
    expect(r.ok).toBe(false);
    expect(r.motivo).toContain("verificar a conexão");
  });

  it("6) historySync falha mapeia motivo amigavel", async () => {
    historySync.mockRejectedValue(new Error("Evolution GO error (500): rate"));
    const { solicitarHistoricoSyncEvolution } = await load();
    const r = await solicitarHistoricoSyncEvolution(dbMock() as never, {} as never, {
      ...instanciaBase,
      evo: {
        ...instanciaBase.evo!,
        historicoSincronizadoEm: new Date("2026-01-01"),
      },
    });
    expect(r.ok).toBe(false);
    expect(r.motivo).toContain("já houve sync recente");
  });

  it("7) sucesso marca requested no banco", async () => {
    const { solicitarHistoricoSyncEvolution } = await load();
    const r = await solicitarHistoricoSyncEvolution(dbMock() as never, {} as never, instanciaBase, {
      count: 3000,
    });
    expect(r.ok).toBe(true);
    expect(historySync).toHaveBeenCalledWith({ count: 3000 });
    expect(updates[0]).toMatchObject({
      historicoSyncStatus: "requested",
      historicoSyncProgress: 0,
      historicoSyncErro: null,
    });
    expect(updates[0]!.historicoSincronizandoEm).toBeInstanceOf(Date);
  });

  it("7b) lock expirado (>30min) permite nova solicitacao", async () => {
    const { solicitarHistoricoSyncEvolution } = await load();
    const antigo = new Date(Date.now() - 31 * 60 * 1000);
    const r = await solicitarHistoricoSyncEvolution(dbMock() as never, {} as never, {
      ...instanciaBase,
      evo: {
        ...instanciaBase.evo!,
        historicoSyncStatus: "running",
        historicoSincronizandoEm: antigo,
      },
    });
    expect(r.ok).toBe(true);
    expect(historySync).toHaveBeenCalled();
  });

  it("7c) failed anterior conta como jaSincronizouAntes no 500", async () => {
    historySync.mockRejectedValue(new Error("Evolution GO error (500)"));
    const { solicitarHistoricoSyncEvolution } = await load();
    const r = await solicitarHistoricoSyncEvolution(dbMock() as never, {} as never, {
      ...instanciaBase,
      evo: {
        ...instanciaBase.evo!,
        historicoSyncStatus: "failed",
      },
    });
    expect(r.motivo).toContain("já houve sync recente");
  });
});

describe("solicitarHistoricoSyncSePrimeiraConexao", () => {
  beforeEach(() => {
    getStatus.mockReset();
    historySync.mockReset();
    updates.length = 0;
    getStatus.mockResolvedValue({ state: "open" });
    historySync.mockResolvedValue(undefined);
  });

  it("8) sem evo no banco nao faz nada", async () => {
    const { solicitarHistoricoSyncSePrimeiraConexao } = await load();
    await solicitarHistoricoSyncSePrimeiraConexao(
      dbMock({ instanciaEvo: async () => null }) as never,
      {} as never,
      1,
      "uuid",
    );
    expect(historySync).not.toHaveBeenCalled();
  });

  it("9) ja sincronizado nao pede de novo", async () => {
    const { solicitarHistoricoSyncSePrimeiraConexao } = await load();
    await solicitarHistoricoSyncSePrimeiraConexao(
      dbMock({
        instanciaEvo: async () => ({
          token: "t",
          historicoSincronizadoEm: new Date(),
          historicoSincronizandoEm: null,
          historicoSyncStatus: "completed",
        }),
      }) as never,
      {} as never,
      1,
      "uuid",
    );
    expect(historySync).not.toHaveBeenCalled();
  });

  it("10) primeira conexao pede sync", async () => {
    const { solicitarHistoricoSyncSePrimeiraConexao } = await load();
    await solicitarHistoricoSyncSePrimeiraConexao(
      dbMock({
        instanciaEvo: async () => ({
          token: "t",
          historicoSincronizadoEm: null,
          historicoSincronizandoEm: null,
          historicoSyncStatus: "idle",
        }),
      }) as never,
      {} as never,
      5,
      "uuid-5",
    );
    expect(historySync).toHaveBeenCalled();
    expect(updates.length).toBeGreaterThan(0);
  });
});

describe("solicitarHistoricoSyncConversaEvolution", () => {
  beforeEach(() => {
    historySync.mockReset();
    historySync.mockResolvedValue(undefined);
    updates.length = 0;
  });

  it("11) sem mensagem ancora (telefone vazio)", async () => {
    const { solicitarHistoricoSyncConversaEvolution } = await load();
    const r = await solicitarHistoricoSyncConversaEvolution(dbMock() as never, {} as never, {
      instanciaId: 1,
      instanciaUuid: "u",
      evoToken: "t",
      conversaIdInterno: 2,
      contatoId: 3,
      telefone: "",
    });
    expect(r.ok).toBe(false);
    expect(r.motivo).toContain("ao menos uma mensagem");
  });

  it("12) sem mensagem ancora", async () => {
    const { solicitarHistoricoSyncConversaEvolution } = await load();
    const r = await solicitarHistoricoSyncConversaEvolution(
      dbMock({
        contatoInstancia: async () => ({ idExterno: "5511999@s.whatsapp.net" }),
        mensagem: async () => null,
      }) as never,
      {} as never,
      {
        instanciaId: 1,
        instanciaUuid: "u",
        evoToken: "t",
        conversaIdInterno: 2,
        contatoId: 3,
        telefone: "5511999999999",
      },
    );
    expect(r.ok).toBe(false);
    expect(r.motivo).toContain("ao menos uma mensagem");
  });

  it("13) sucesso chama historySync on-demand com messageInfo", async () => {
    const criadoEm = new Date("2026-07-01T12:00:00.000Z");
    const { solicitarHistoricoSyncConversaEvolution } = await load();
    const r = await solicitarHistoricoSyncConversaEvolution(
      dbMock({
        contatoInstancia: async () => ({ idExterno: "5511999@s.whatsapp.net" }),
        mensagem: async () => ({
          idExterno: "MSG-ANCORA",
          direcao: "inbound",
          criadoEm,
        }),
      }) as never,
      {} as never,
      {
        instanciaId: 1,
        instanciaUuid: "u",
        evoToken: "t",
        conversaIdInterno: 2,
        contatoId: 3,
        telefone: "5511999999999",
        count: 50,
      },
    );
    expect(r.ok).toBe(true);
    expect(historySync).toHaveBeenCalledWith({
      count: 50,
      messageInfo: {
        chat: "5511999@s.whatsapp.net",
        id: "MSG-ANCORA",
        isFromMe: false,
        timestamp: criadoEm.toISOString(),
      },
    });
    expect(updates).toHaveLength(0);
  });

  it("14) outbound ancora usa isFromMe true", async () => {
    const criadoEm = new Date("2026-07-01T12:00:00.000Z");
    const { solicitarHistoricoSyncConversaEvolution } = await load();
    await solicitarHistoricoSyncConversaEvolution(
      dbMock({
        contatoInstancia: async () => ({ idExterno: null }),
        mensagem: async () => ({
          idExterno: "OUT-1",
          direcao: "outbound",
          criadoEm,
        }),
      }) as never,
      {} as never,
      {
        instanciaId: 1,
        instanciaUuid: "u",
        evoToken: "t",
        conversaIdInterno: 2,
        contatoId: 3,
        telefone: "5511888888888",
      },
    );
    expect(historySync.mock.calls[0]![0].messageInfo.isFromMe).toBe(true);
  });

  it("15) erro Evolution retorna motivo amigavel", async () => {
    historySync.mockRejectedValue(new Error("Evolution GO error (404)"));
    const { solicitarHistoricoSyncConversaEvolution } = await load();
    const r = await solicitarHistoricoSyncConversaEvolution(
      dbMock({
        contatoInstancia: async () => ({ idExterno: "5511@s.whatsapp.net" }),
        mensagem: async () => ({
          idExterno: "M1",
          direcao: "inbound",
          criadoEm: new Date(),
        }),
      }) as never,
      {} as never,
      {
        instanciaId: 1,
        instanciaUuid: "u",
        evoToken: "t",
        conversaIdInterno: 2,
        contatoId: 3,
        telefone: "5511",
      },
    );
    expect(r.ok).toBe(false);
    expect(r.motivo).toContain("não encontrada");
  });

  it("15b) 500 na conversa = copy genérica (sem jaSincronizouAntes)", async () => {
    historySync.mockRejectedValue(new Error('Evolution GO error (500): {"error":"internal"}'));
    const { solicitarHistoricoSyncConversaEvolution } = await load();
    const r = await solicitarHistoricoSyncConversaEvolution(
      dbMock({
        contatoInstancia: async () => ({ idExterno: "5511@s.whatsapp.net" }),
        mensagem: async () => ({
          idExterno: "M1",
          direcao: "inbound",
          criadoEm: new Date(),
        }),
      }) as never,
      {} as never,
      {
        instanciaId: 1,
        instanciaUuid: "u",
        evoToken: "t",
        conversaIdInterno: 2,
        contatoId: 3,
        telefone: "5511",
      },
    );
    expect(r.ok).toBe(false);
    expect(r.motivo).toBe(
      "O WhatsApp não conseguiu iniciar a sincronização agora. Confirme que a sessão está conectada e tente de novo em alguns minutos.",
    );
    expect(r.motivo).not.toContain("já houve sync recente");
  });

  it("15c) 502 na conversa usa a mesma copy de 500", async () => {
    historySync.mockRejectedValue(new Error("Evolution GO error (502): bad gateway"));
    const { solicitarHistoricoSyncConversaEvolution } = await load();
    const r = await solicitarHistoricoSyncConversaEvolution(
      dbMock({
        contatoInstancia: async () => ({ idExterno: "5511@s.whatsapp.net" }),
        mensagem: async () => ({
          idExterno: "M1",
          direcao: "inbound",
          criadoEm: new Date(),
        }),
      }) as never,
      {} as never,
      {
        instanciaId: 1,
        instanciaUuid: "u",
        evoToken: "t",
        conversaIdInterno: 2,
        contatoId: 3,
        telefone: "5511",
      },
    );
    expect(r.ok).toBe(false);
    expect(r.motivo).toContain("não conseguiu iniciar");
  });

  it("16) telefone vazio usa idExterno do vinculo", async () => {
    const criadoEm = new Date("2026-07-01T12:00:00.000Z");
    const { solicitarHistoricoSyncConversaEvolution } = await load();
    const r = await solicitarHistoricoSyncConversaEvolution(
      dbMock({
        contatoInstancia: async () => ({ idExterno: "5511999888777@s.whatsapp.net" }),
        mensagem: async () => ({
          idExterno: "ANC-LID",
          direcao: "inbound",
          criadoEm,
        }),
      }) as never,
      {} as never,
      {
        instanciaId: 1,
        instanciaUuid: "u",
        evoToken: "t",
        conversaIdInterno: 2,
        contatoId: 3,
        telefone: null,
      },
    );
    expect(r.ok).toBe(true);
    expect(historySync).toHaveBeenCalledWith({
      count: 100,
      messageInfo: {
        chat: "5511999888777@s.whatsapp.net",
        id: "ANC-LID",
        isFromMe: false,
        timestamp: criadoEm.toISOString(),
      },
    });
  });

  it("17) count padrao on-demand e 100", async () => {
    const { solicitarHistoricoSyncConversaEvolution } = await load();
    await solicitarHistoricoSyncConversaEvolution(
      dbMock({
        contatoInstancia: async () => ({ idExterno: "5511@s.whatsapp.net" }),
        mensagem: async () => ({
          idExterno: "M-DEF",
          direcao: "inbound",
          criadoEm: new Date(),
        }),
      }) as never,
      {} as never,
      {
        instanciaId: 1,
        instanciaUuid: "u",
        evoToken: "t",
        conversaIdInterno: 2,
        contatoId: 3,
        telefone: "5511",
      },
    );
    expect(historySync.mock.calls[0]![0].count).toBe(100);
  });

  it("18) 401 no sync completo retorna sessao invalida", async () => {
    historySync.mockRejectedValue(new Error("Evolution GO error (401)"));
    const { solicitarHistoricoSyncEvolution } = await load();
    const r = await solicitarHistoricoSyncEvolution(dbMock() as never, {} as never, instanciaBase);
    expect(r.ok).toBe(false);
    expect(r.motivo).toContain("inválida");
  });

  it("19) requested bloqueia nova solicitacao", async () => {
    const { solicitarHistoricoSyncEvolution } = await load();
    const r = await solicitarHistoricoSyncEvolution(dbMock() as never, {} as never, {
      ...instanciaBase,
      evo: {
        ...instanciaBase.evo!,
        historicoSyncStatus: "requested",
        historicoSincronizandoEm: new Date(),
      },
    });
    expect(r.ok).toBe(false);
    expect(historySync).not.toHaveBeenCalled();
  });
});
