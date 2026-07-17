import { describe, expect, it } from "vitest";
import { QueryClient } from "@tanstack/react-query";

import {
  limparColecoesInbox,
  obterColecaoConversas,
  obterColecaoMensagens,
  lerTemMaisAntigas,
} from "./collections";

describe("inbox-db collections", () => {
  it("memoiza collections por org/conversa e limpa no logout", () => {
    const qc = new QueryClient();
    const a = obterColecaoConversas(qc, "org-1", null);
    const b = obterColecaoConversas(qc, "org-1", null);
    expect(a).toBe(b);

    const m1 = obterColecaoMensagens(qc, "c-1", null);
    const m2 = obterColecaoMensagens(qc, "c-1", null);
    expect(m1).toBe(m2);

    limparColecoesInbox(qc);
    const c = obterColecaoConversas(qc, "org-1", null);
    expect(c).not.toBe(a);
  });

  it("isola por organizacaoHash / conversaId", () => {
    const qc = new QueryClient();
    const o1 = obterColecaoConversas(qc, "org-a", null);
    const o2 = obterColecaoConversas(qc, "org-b", null);
    expect(o1).not.toBe(o2);

    const c1 = obterColecaoMensagens(qc, "conv-a", null);
    const c2 = obterColecaoMensagens(qc, "conv-b", null);
    expect(c1).not.toBe(c2);
  });

  it("epoch diferente gera nova collection (wipe SQLite)", () => {
    const qc = new QueryClient();
    const e0 = obterColecaoConversas(qc, "org-1", null, 0);
    const e1 = obterColecaoConversas(qc, "org-1", null, 1);
    expect(e0).not.toBe(e1);
    expect(obterColecaoConversas(qc, "org-1", null, 1)).toBe(e1);
  });

  it("temMaisAntigas inicia false sem sync", () => {
    const qc = new QueryClient();
    expect(lerTemMaisAntigas(qc, "conversa-x")).toBe(false);
  });

  it("ids das collections são estáveis e distintos", () => {
    const qc = new QueryClient();
    const conv = obterColecaoConversas(qc, "org-z", null);
    const convArq = obterColecaoConversas(qc, "org-z", null, 0, true);
    const msg = obterColecaoMensagens(qc, "c-z", null);
    expect(conv.id).toBe("inbox-conversas-org-z-ativ");
    expect(convArq.id).toBe("inbox-conversas-org-z-arq");
    expect(conv).not.toBe(convArq);
    expect(msg.id).toBe("inbox-mensagens-c-z");
  });
});
