import { describe, expect, it } from "vitest";
import { QueryClient, QueryObserver } from "@tanstack/react-query";

import {
  caminhoNaAllowlistPersist,
  caminhoQueryKeyOrpc,
  shouldDehydrateInboxQuery,
} from "./query-persist";

describe("caminhoQueryKeyOrpc", () => {
  it("extrai path ORPC do queryKey", () => {
    expect(
      caminhoQueryKeyOrpc([["caixaEntrada", "conversas", "lista"], { input: { a: 1 } }]),
    ).toEqual(["caixaEntrada", "conversas", "lista"]);
  });

  it("extrai path flat de Query Collection", () => {
    expect(caminhoQueryKeyOrpc(["inbox-db", "conversas", "org"])).toEqual([
      "inbox-db",
      "conversas",
      "org",
    ]);
  });

  it("retorna null para keys sem path", () => {
    expect(caminhoQueryKeyOrpc([])).toBeNull();
    expect(caminhoQueryKeyOrpc([1, 2])).toBeNull();
  });
});

describe("caminhoNaAllowlistPersist", () => {
  it("aceita prefixos da inbox e org/instância", () => {
    expect(caminhoNaAllowlistPersist(["caixaEntrada", "conversas", "lista"])).toBe(true);
    expect(caminhoNaAllowlistPersist(["caixaEntrada", "mensagens", "lista"])).toBe(true);
    expect(caminhoNaAllowlistPersist(["organizacao", "obter"])).toBe(true);
    expect(caminhoNaAllowlistPersist(["instancia", "lista"])).toBe(true);
  });

  it("rejeita QR, midia e autenticação", () => {
    expect(caminhoNaAllowlistPersist(["instancia", "obterQr"])).toBe(false);
    expect(caminhoNaAllowlistPersist(["caixaEntrada", "midia", "upload"])).toBe(false);
    expect(caminhoNaAllowlistPersist(["autenticacao", "eu"])).toBe(false);
  });
});

describe("shouldDehydrateInboxQuery", () => {
  it("persiste conversas e mensagens ORPC com sucesso", async () => {
    const client = new QueryClient();
    await client.fetchQuery({
      queryKey: [["caixaEntrada", "conversas", "lista"], { input: { organizacaoHash: "o" } }],
      queryFn: async () => [{ id: "1" }],
    });
    await client.fetchQuery({
      queryKey: [["caixaEntrada", "mensagens", "lista"], { input: { conversaId: "c" } }],
      queryFn: async () => [{ id: "m1" }],
    });

    const conversas = client.getQueryCache().find({
      queryKey: [["caixaEntrada", "conversas", "lista"], { input: { organizacaoHash: "o" } }],
    });
    const mensagens = client.getQueryCache().find({
      queryKey: [["caixaEntrada", "mensagens", "lista"], { input: { conversaId: "c" } }],
    });

    expect(conversas && shouldDehydrateInboxQuery(conversas)).toBe(true);
    expect(mensagens && shouldDehydrateInboxQuery(mensagens)).toBe(true);
  });

  it("não persiste obterQr mesmo com sucesso", async () => {
    const client = new QueryClient();
    await client.fetchQuery({
      queryKey: [["instancia", "obterQr"], { input: { instanciaId: "i" } }],
      queryFn: async () => ({ qr: "data:..." }),
    });
    const qr = client.getQueryCache().find({
      queryKey: [["instancia", "obterQr"], { input: { instanciaId: "i" } }],
    });
    expect(qr && shouldDehydrateInboxQuery(qr)).toBe(false);
  });

  it("não persiste query ainda pendente", () => {
    const client = new QueryClient();
    const observer = new QueryObserver(client, {
      queryKey: [["caixaEntrada", "conversas", "lista"], { input: { organizacaoHash: "o" } }],
      queryFn: () => new Promise(() => {}),
    });
    observer.subscribe(() => {});
    const pending = client.getQueryCache().find({
      queryKey: [["caixaEntrada", "conversas", "lista"], { input: { organizacaoHash: "o" } }],
    });
    expect(pending && shouldDehydrateInboxQuery(pending)).toBe(false);
    observer.destroy();
  });
});
