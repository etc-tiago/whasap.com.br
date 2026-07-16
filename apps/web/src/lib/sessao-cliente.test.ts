/**
 * Cleanup de sessão — logout / 401.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { QueryClient } from "@tanstack/react-query";

const { limparColecoesInbox, limparCachePersistido, solicitarWipePersistenciaSqliteInbox } =
  vi.hoisted(() => ({
    limparColecoesInbox: vi.fn(),
    limparCachePersistido: vi.fn(async (): Promise<void> => {}),
    solicitarWipePersistenciaSqliteInbox: vi.fn(async (): Promise<void> => {}),
  }));

vi.mock("@/lib/inbox-db", () => ({
  limparColecoesInbox,
  solicitarWipePersistenciaSqliteInbox,
}));

vi.mock("@/lib/query-persist", () => ({
  limparCachePersistido,
}));

vi.mock("@/lib/orpc", () => ({
  orpc: {
    autenticacao: {
      eu: {
        key: () => [["autenticacao", "eu"]],
      },
    },
  },
}));

describe("limparEstadoClienteSessao", () => {
  beforeEach(() => {
    limparColecoesInbox.mockClear();
    limparCachePersistido.mockClear();
    solicitarWipePersistenciaSqliteInbox.mockClear();
    limparCachePersistido.mockResolvedValue(undefined);
    solicitarWipePersistenciaSqliteInbox.mockResolvedValue(undefined);
    vi.resetModules();
  });

  it("limpa collections, Query Persist e SQLite OPFS", async () => {
    const { limparEstadoClienteSessao } = await import("./sessao-cliente");
    const qc = new QueryClient();
    const setData = vi.spyOn(qc, "setQueryData");
    const cancel = vi.spyOn(qc, "cancelQueries").mockResolvedValue(undefined);

    await limparEstadoClienteSessao(qc);

    expect(cancel).toHaveBeenCalled();
    expect(limparColecoesInbox).toHaveBeenCalledWith(qc);
    expect(limparCachePersistido).toHaveBeenCalledWith(qc);
    expect(solicitarWipePersistenciaSqliteInbox).toHaveBeenCalledTimes(1);
    expect(setData).toHaveBeenCalledWith([["autenticacao", "eu"]], null);
  });

  it("é reentrante — segunda chamada em paralelo não duplica wipe", async () => {
    let resolver!: () => void;
    limparCachePersistido.mockImplementation(
      () =>
        new Promise<void>((r) => {
          resolver = r;
        }),
    );

    const { limparEstadoClienteSessao } = await import("./sessao-cliente");
    const qc = new QueryClient();
    vi.spyOn(qc, "cancelQueries").mockResolvedValue(undefined);

    const primeira = limparEstadoClienteSessao(qc);
    // Deixa cancelQueries resolver e chegar no await de limparCachePersistido.
    await Promise.resolve();
    await Promise.resolve();
    const segunda = limparEstadoClienteSessao(qc);
    expect(resolver).toBeTypeOf("function");
    resolver();
    await Promise.all([primeira, segunda]);

    expect(limparColecoesInbox).toHaveBeenCalledTimes(1);
    expect(solicitarWipePersistenciaSqliteInbox).toHaveBeenCalledTimes(1);
  });

  it("após concluir, não limpa de novo até reabrirSessaoCliente (anti-loop 401)", async () => {
    const { limparEstadoClienteSessao, reabrirSessaoCliente, sessaoClienteEncerrada } =
      await import("./sessao-cliente");
    const qc = new QueryClient();
    vi.spyOn(qc, "cancelQueries").mockResolvedValue(undefined);

    await limparEstadoClienteSessao(qc);
    expect(sessaoClienteEncerrada()).toBe(true);
    expect(limparColecoesInbox).toHaveBeenCalledTimes(1);

    await limparEstadoClienteSessao(qc);
    expect(limparColecoesInbox).toHaveBeenCalledTimes(1);

    reabrirSessaoCliente();
    expect(sessaoClienteEncerrada()).toBe(false);

    await limparEstadoClienteSessao(qc);
    expect(limparColecoesInbox).toHaveBeenCalledTimes(2);
  });

  it("libera o lock após erro para permitir nova tentativa", async () => {
    limparCachePersistido.mockRejectedValueOnce(new Error("idb falhou"));
    const { limparEstadoClienteSessao, sessaoClienteEncerrada } = await import("./sessao-cliente");
    const qc = new QueryClient();
    vi.spyOn(qc, "cancelQueries").mockResolvedValue(undefined);

    await expect(limparEstadoClienteSessao(qc)).rejects.toThrow("idb falhou");
    expect(sessaoClienteEncerrada()).toBe(false);

    limparCachePersistido.mockResolvedValue(undefined);
    await limparEstadoClienteSessao(qc);
    expect(limparColecoesInbox).toHaveBeenCalledTimes(2);
  });
});
