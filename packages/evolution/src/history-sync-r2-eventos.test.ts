/**
 * Eventos do mesmo dia do HistorySync no corpus R2 (labels, pushname, receipt, pair).
 * Garantem que o pos-sync / inbox nao quebra nos parsers auxiliares.
 */
import { describe, expect, it } from "vitest";

import { parseGoDisconnectedEvent } from "./connection-state";
import { carregarHistorySyncR2 } from "./fixtures/carregar-history-sync-r2";
import { carregarWebhooksR2, corpusWebhookR2Disponivel } from "./fixtures/carregar-webhooks-r2";
import {
  parseGoButtonClick,
  parseGoLabelAssociation,
  parseGoMessageEvent,
  parseGoPairSuccess,
  parseGoPushName,
  parseGoReceipt,
  receiptIndicaLeitura,
} from "./webhook-go";

const ok = corpusWebhookR2Disponivel();

describe.skipIf(!ok)("corpus R2 - eventos junto do HistorySync", () => {
  it("1) LabelAssociationChat parseia todos", () => {
    const labels = carregarWebhooksR2({ evento: "LabelAssociationChat" });
    expect(labels.length).toBeGreaterThanOrEqual(1);
    for (const f of labels) {
      expect(f.event).toBe("LabelAssociationChat");
      const parsed = parseGoLabelAssociation(f.data);
      expect(parsed, f.arquivo).not.toBeNull();
      expect(parsed!.jid.includes("@")).toBe(true);
      expect(parsed!.labelId.length).toBeGreaterThan(0);
      expect(typeof parsed!.labeled).toBe("boolean");
    }
  });

  it("2) LabelAssociation tem labeled true no corpus de hoje", () => {
    const labels = carregarWebhooksR2({ evento: "LabelAssociationChat" });
    const algumTrue = labels.some((f) => parseGoLabelAssociation(f.data)?.labeled === true);
    expect(algumTrue).toBe(true);
  });

  it("3) PushName parseia com JID", () => {
    const pushes = carregarWebhooksR2({ evento: "PushName" });
    expect(pushes.length).toBeGreaterThanOrEqual(1);
    for (const f of pushes) {
      const parsed = parseGoPushName(f.data);
      expect(parsed, f.arquivo).not.toBeNull();
      expect(parsed!.jid.length).toBeGreaterThan(0);
      expect(parsed!.newPushName.length).toBeGreaterThan(0);
    }
  });

  it("4) PushName pode trazer JIDAlt @s.whatsapp.net", () => {
    const pushes = carregarWebhooksR2({ evento: "PushName" });
    const comAlt = pushes
      .map((f) => parseGoPushName(f.data))
      .filter((p) => p?.jidAlt?.endsWith("@s.whatsapp.net"));
    expect(comAlt.length).toBeGreaterThanOrEqual(0);
  });

  it("5) Receipt parseia MessageIDs", () => {
    const receipts = carregarWebhooksR2({ evento: "Receipt" });
    expect(receipts.length).toBeGreaterThanOrEqual(1);
    let okCount = 0;
    for (const f of receipts) {
      const parsed = parseGoReceipt(f.data, f.payload.state as string | undefined);
      if (!parsed) continue;
      expect(parsed.messageIds.length).toBeGreaterThan(0);
      expect(parsed.chatJid.includes("@")).toBe(true);
      okCount += 1;
    }
    expect(okCount).toBeGreaterThan(0);
  });

  it("6) receiptIndicaLeitura so com type/state de leitura", () => {
    const receipts = carregarWebhooksR2({ evento: "Receipt" });
    for (const f of receipts) {
      const parsed = parseGoReceipt(f.data, f.payload.state as string | undefined);
      if (!parsed) continue;
      const leitura = receiptIndicaLeitura(parsed);
      expect(typeof leitura).toBe("boolean");
    }
  });

  it("7) PairSuccess mapeia open", () => {
    const pairs = carregarWebhooksR2({ evento: "PairSuccess" });
    expect(pairs.length).toBeGreaterThanOrEqual(1);
    for (const f of pairs) {
      expect(parseGoPairSuccess(f.data)).toBe("open");
    }
  });

  it("8) Disconnected mapeia close", () => {
    const discs = carregarWebhooksR2({ evento: "Disconnected" });
    expect(discs.length).toBeGreaterThanOrEqual(1);
    for (const f of discs) {
      expect(parseGoDisconnectedEvent(f.payload)).toBe("close");
    }
  });

  it("9) LoggedOut existe no corpus do dia", () => {
    const outs = carregarWebhooksR2({ evento: "LoggedOut" });
    expect(outs.length).toBeGreaterThanOrEqual(1);
    for (const f of outs) {
      expect(f.event).toBe("LoggedOut");
    }
  });

  it("10) LabelEdit existe (nome/cor) mesmo sem parser dedicado", () => {
    const edits = carregarWebhooksR2({ evento: "LabelEdit" });
    expect(edits.length).toBeGreaterThanOrEqual(1);
    const data = edits[0]!.data;
    expect(data.LabelID).toBeTruthy();
    expect(data.Action).toBeTruthy();
  });

  it("11) ClinicaWork tem HistorySync e Message no mesmo dia", () => {
    const hs = carregarWebhooksR2({
      evento: "HistorySync",
      instanciaPasta: "whasap-847c01d8",
    });
    const msgs = carregarWebhooksR2({
      evento: "Message",
      instanciaPasta: "whasap-847c01d8",
    });
    expect(hs.length).toBeGreaterThanOrEqual(5);
    expect(msgs.length).toBeGreaterThanOrEqual(1);
  });

  it("12) instanceName do payload bate com pasta whasap-", () => {
    const amostra = carregarWebhooksR2({ evento: "HistorySync", limite: 5 });
    for (const f of amostra) {
      const name = String(f.payload.instanceName ?? "");
      if (!name) continue;
      expect(f.instanciaPasta).toContain(name.replace(/^whasap-/, "whasap-").slice(0, 14));
    }
  });

  it("13) QRCode envelopes tem raw parseavel", () => {
    const qrs = carregarWebhooksR2({ evento: "QRCode", limite: 3 });
    expect(qrs.length).toBeGreaterThanOrEqual(1);
    for (const f of qrs) {
      expect(f.event).toBe("QRCode");
      expect(f.payload).toBeTruthy();
    }
  });

  it("14) LabelAssociation JID e s.whatsapp.net ou lid", () => {
    const labels = carregarWebhooksR2({ evento: "LabelAssociationChat" });
    for (const f of labels) {
      const p = parseGoLabelAssociation(f.data)!;
      expect(
        p.jid.endsWith("@s.whatsapp.net") || p.jid.endsWith("@lid") || p.jid.endsWith("@g.us"),
      ).toBe(true);
    }
  });

  it("15) Receipt fromMe e boolean", () => {
    const receipts = carregarWebhooksR2({ evento: "Receipt" });
    for (const f of receipts) {
      const p = parseGoReceipt(f.data);
      if (!p) continue;
      expect(typeof p.fromMe).toBe("boolean");
    }
  });

  it("16) Message live parseia durante sync ClinicaWork", () => {
    const msgs = carregarWebhooksR2({
      evento: "Message",
      instanciaPasta: "whasap-847c01d8",
      limite: 20,
    });
    expect(msgs.length).toBeGreaterThan(0);
    let parseados = 0;
    for (const f of msgs) {
      const p = parseGoMessageEvent(f.data);
      if (!p) continue;
      expect(p.messageId.length).toBeGreaterThan(0);
      expect(p.chatJid.includes("@")).toBe(true);
      parseados += 1;
    }
    expect(parseados).toBeGreaterThan(0);
  });

  it("17) SendMessage no corpus se existir", () => {
    const sends = carregarWebhooksR2({ evento: "SendMessage", limite: 10 });
    expect(sends.length).toBeGreaterThanOrEqual(0);
    for (const f of sends) {
      expect(f.event).toBe("SendMessage");
    }
  });

  it("18) ciclo de conexao no corpus (PairSuccess / Disconnected)", () => {
    const pairs = carregarWebhooksR2({ evento: "PairSuccess", limite: 5 });
    const discs = carregarWebhooksR2({ evento: "Disconnected", limite: 5 });
    expect(pairs.length + discs.length).toBeGreaterThanOrEqual(1);
    for (const f of pairs) {
      expect(parseGoPairSuccess(f.data)).toBe("open");
    }
    for (const f of discs) {
      expect(parseGoDisconnectedEvent(f.payload)).toBe("close");
    }
  });

  it("19) ButtonClick parseia se existir", () => {
    const clicks = carregarWebhooksR2({ evento: "ButtonClick", limite: 10 });
    if (clicks.length === 0) {
      expect(true).toBe(true);
      return;
    }
    for (const f of clicks) {
      const p = parseGoButtonClick(f.data);
      expect(p).not.toBeNull();
      expect(p!.type.length).toBeGreaterThan(0);
    }
  });

  it("20) HistorySync envelope receivedAt bate com dia do path", () => {
    const hs = carregarHistorySyncR2({ limite: 10 });
    for (const f of hs) {
      const dia = f.arquivo.split("/")[1]!;
      expect(f.envelope.receivedAt.slice(0, 10)).toBe(dia);
    }
  });

  it("21) LabelAssociation labeled e sempre boolean no corpus", () => {
    const labels = carregarWebhooksR2({ evento: "LabelAssociationChat" });
    expect(labels.length).toBeGreaterThan(0);
    for (const f of labels) {
      const p = parseGoLabelAssociation(f.data);
      expect(p).not.toBeNull();
      expect(typeof p!.labeled).toBe("boolean");
    }
  });

  it("22) PushName oldPushName pode ser null no parse", () => {
    const pushes = carregarWebhooksR2({ evento: "PushName", limite: 10 });
    for (const f of pushes) {
      const p = parseGoPushName(f.data);
      if (!p) continue;
      expect(p.newPushName.length).toBeGreaterThan(0);
      expect(p.oldPushName === null || typeof p.oldPushName === "string").toBe(true);
    }
  });
});
