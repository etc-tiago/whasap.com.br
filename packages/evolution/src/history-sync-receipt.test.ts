/**
 * Receipt durante/apos HistorySync — leitura e normalizacao.
 */
import { describe, expect, it } from "vitest";

import { carregarWebhooksR2, corpusWebhookR2Disponivel } from "./fixtures/carregar-webhooks-r2";
import { parseGoReceipt, receiptIndicaLeitura } from "./webhook-go";

describe("parseGoReceipt (sintetico)", () => {
  it("1) payload minimo valido", () => {
    const r = parseGoReceipt({
      Chat: "5511@s.whatsapp.net",
      MessageIDs: ["ABC123"],
      Type: "read",
      IsFromMe: false,
    });
    expect(r).toEqual({
      chatJid: "5511@s.whatsapp.net",
      messageIds: ["ABC123"],
      type: "read",
      fromMe: false,
      state: null,
    });
  });

  it("2) sem Chat retorna null", () => {
    expect(parseGoReceipt({ MessageIDs: ["x"] })).toBeNull();
  });

  it("3) sem MessageIDs retorna null", () => {
    expect(parseGoReceipt({ Chat: "5511@s.whatsapp.net", MessageIDs: [] })).toBeNull();
  });

  it("3b) MessageIDs só vazios/whitespace retorna null; mistura mantém válidos", () => {
    expect(
      parseGoReceipt({
        Chat: "5511@s.whatsapp.net",
        MessageIDs: ["", "  "],
        Type: "read",
      }),
    ).toBeNull();
    expect(
      parseGoReceipt({
        Chat: "5511@s.whatsapp.net",
        MessageIDs: ["", "ABC", "  "],
        Type: "read",
      })!.messageIds,
    ).toEqual(["ABC"]);
  });

  it("4) state externo preenchido", () => {
    const r = parseGoReceipt(
      { Chat: "5511@s.whatsapp.net", MessageIDs: ["M1"], Type: "DELIVERED" },
      "DELIVERED",
    );
    expect(r!.type).toBe("delivered");
    expect(r!.state).toBe("DELIVERED");
  });

  it("4b) Type vazio + state Delivered = nao leitura", () => {
    const r = parseGoReceipt(
      {
        Chat: "5511@s.whatsapp.net",
        MessageIDs: ["M1"],
        Type: "",
        IsFromMe: true,
      },
      "Delivered",
    );
    expect(r).not.toBeNull();
    expect(r!.type).toBe("");
    expect(r!.state).toBe("Delivered");
    expect(receiptIndicaLeitura(r!)).toBe(false);
  });

  it("5) multiplos MessageIDs", () => {
    const r = parseGoReceipt({
      Chat: "5511@s.whatsapp.net",
      MessageIDs: ["A", "B", "C"],
      Type: "played",
    });
    expect(r!.messageIds).toHaveLength(3);
  });
});

describe("receiptIndicaLeitura", () => {
  it("6) type read = leitura", () => {
    expect(
      receiptIndicaLeitura({
        chatJid: "x",
        messageIds: ["1"],
        type: "read",
        fromMe: false,
        state: null,
      }),
    ).toBe(true);
  });

  it("7) type played = leitura", () => {
    expect(
      receiptIndicaLeitura({
        chatJid: "x",
        messageIds: ["1"],
        type: "played",
        fromMe: true,
        state: null,
      }),
    ).toBe(true);
  });

  it("8) state READ conta como leitura", () => {
    expect(
      receiptIndicaLeitura({
        chatJid: "x",
        messageIds: ["1"],
        type: "delivery",
        fromMe: false,
        state: "READ",
      }),
    ).toBe(true);
  });

  it("9) delivered sozinho nao e leitura", () => {
    expect(
      receiptIndicaLeitura({
        chatJid: "x",
        messageIds: ["1"],
        type: "delivered",
        fromMe: false,
        state: "DELIVERED",
      }),
    ).toBe(false);
  });

  it("10) sent nao e leitura", () => {
    expect(
      receiptIndicaLeitura({
        chatJid: "x",
        messageIds: ["1"],
        type: "sender",
        fromMe: true,
        state: null,
      }),
    ).toBe(false);
  });
});

const corpusOk = corpusWebhookR2Disponivel();

describe.skipIf(!corpusOk)("Receipt corpus R2", () => {
  it("11) todos Receipt parseados tem type lowercase", () => {
    const receipts = carregarWebhooksR2({ evento: "Receipt", limite: 30 });
    for (const f of receipts) {
      const p = parseGoReceipt(f.data, f.payload.state as string | undefined);
      if (!p) continue;
      expect(p.type).toBe(p.type.toLowerCase());
    }
  });

  it("12) pelo menos um receipt indica leitura no corpus", () => {
    const receipts = carregarWebhooksR2({ evento: "Receipt" });
    const algum = receipts.some((f) => {
      const p = parseGoReceipt(f.data, f.payload.state as string | undefined);
      return p && receiptIndicaLeitura(p);
    });
    expect(algum).toBe(true);
  });

  it("13) MessageIDs nunca vazio quando parse ok", () => {
    const receipts = carregarWebhooksR2({ evento: "Receipt", limite: 20 });
    let ok = 0;
    for (const f of receipts) {
      const p = parseGoReceipt(f.data);
      if (!p) continue;
      expect(p.messageIds.every((id) => id.length > 0)).toBe(true);
      ok += 1;
    }
    expect(ok).toBeGreaterThan(0);
  });
});
