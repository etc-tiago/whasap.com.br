import { describe, expect, it } from "vitest";
import { QueryClient } from "@tanstack/react-query";

import { limparColecoesInbox, obterColecaoConversas, obterColecaoMensagens } from "./collections";

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
});
