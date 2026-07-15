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
    await limparEstadoClienteSessao(qc);

    expect(limparColecoesInbox).toHaveBeenCalledWith(qc);
    expect(limparCachePersistido).toHaveBeenCalledWith(qc);
    expect(solicitarWipePersistenciaSqliteInbox).toHaveBeenCalledTimes(1);
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
    const primeira = limparEstadoClienteSessao(qc);
    const segunda = limparEstadoClienteSessao(qc);
    resolver();
    await Promise.all([primeira, segunda]);

    expect(limparColecoesInbox).toHaveBeenCalledTimes(1);
    expect(solicitarWipePersistenciaSqliteInbox).toHaveBeenCalledTimes(1);
  });

  it("libera o lock após erro para permitir nova tentativa", async () => {
    limparCachePersistido.mockRejectedValueOnce(new Error("idb falhou"));
    const { limparEstadoClienteSessao } = await import("./sessao-cliente");
    const qc = new QueryClient();

    await expect(limparEstadoClienteSessao(qc)).rejects.toThrow("idb falhou");

    limparCachePersistido.mockResolvedValue(undefined);
    await limparEstadoClienteSessao(qc);
    expect(limparColecoesInbox).toHaveBeenCalledTimes(2);
  });
});
