/**
 * Matriz soft contra corpus R2 local (`packages/r2-sync/json/webhook/evo`).
 * Limiares mínimos quando o corpus está cheio; eventos ausentes (pós-purge) não falham.
 */
import { describe, expect, it } from "vitest";

import { parseGoDisconnectedEvent, parseConnectionUpdateWebhook } from "./connection-state";
import { carregarWebhooksR2, corpusWebhookR2Disponivel } from "./fixtures/carregar-webhooks-r2";
import { extrairMidiaGoDeMessageObj } from "./midia-go";
import {
  parseGoContact,
  parseGoGroupInfo,
  parseGoJoinedGroup,
  parseGoLabelAssociation,
  parseGoLabelEdit,
  parseGoMessageEvent,
  parseGoPicture,
  parseGoPushName,
  parseGoQrTimeout,
  parseGoReceipt,
  receiptIndicaLeitura,
  resolverIdExternoCanonicoGo,
  telefoneExibicaoDeInfo,
} from "./webhook-go";

const ok = corpusWebhookR2Disponivel();

describe.skipIf(!ok)("matriz R2 evo (corpus local)", () => {
  const fixtures = ok ? carregarWebhooksR2() : [];
  const events = new Set(fixtures.map((f) => f.event));

  it("1) carrega corpus com Message e Receipt", () => {
    expect(fixtures.length).toBeGreaterThanOrEqual(10);
    expect(events.has("Message")).toBe(true);
    expect(events.has("Receipt")).toBe(true);
    // HistorySync é desejável em corpus cheio, mas opcional após purge parcial.
    if (events.has("HistorySync")) {
      expect(fixtures.filter((f) => f.event === "HistorySync").length).toBeGreaterThan(0);
    }
  });

  it("2) Messages: taxa de parse alta + corpo presente", () => {
    const messages = fixtures.filter((f) => f.event === "Message");
    expect(messages.length).toBeGreaterThanOrEqual(1);

    let okParse = 0;
    const tipos = new Set<string>();
    for (const fixture of messages) {
      const parsed = parseGoMessageEvent(fixture.data);
      if (!parsed) continue;
      okParse += 1;
      expect(parsed.body.length, fixture.arquivo).toBeGreaterThan(0);
      expect(parsed.messageId, fixture.arquivo).toBeTruthy();
      tipos.add(parsed.type);

      const info = fixture.data.Info as Record<string, unknown>;
      expect(resolverIdExternoCanonicoGo(info), fixture.arquivo).toBeTruthy();
    }

    expect(okParse / messages.length).toBeGreaterThan(0.85);
    expect(tipos.size).toBeGreaterThan(0);
  });

  it("3) Receipts parseiam (Delivered Type vazio + Read)", () => {
    const receipts = fixtures.filter((f) => f.event === "Receipt");
    expect(receipts.length).toBeGreaterThanOrEqual(1);

    let parseados = 0;
    let delivered = 0;
    let read = 0;
    for (const fixture of receipts) {
      const parsed = parseGoReceipt(fixture.data, fixture.payload.state as string | undefined);
      if (!parsed) continue;
      parseados += 1;
      expect(parsed.messageIds.length).toBeGreaterThan(0);
      if ((parsed.state ?? "").toLowerCase() === "delivered" && !parsed.type) {
        delivered += 1;
        expect(receiptIndicaLeitura(parsed)).toBe(false);
      }
      if (parsed.type.includes("read") || (parsed.state ?? "").toLowerCase().includes("read")) {
        read += 1;
        expect(receiptIndicaLeitura(parsed)).toBe(true);
      }
    }
    expect(parseados / receipts.length).toBeGreaterThan(0.9);
    expect(delivered + read).toBeGreaterThan(0);
  });

  it("3b) SendMessage parseia com parseGoMessageEvent (texto + mídia)", () => {
    const sends = fixtures.filter((f) => f.event === "SendMessage");
    if (sends.length === 0) return;

    let okParse = 0;
    let comBase64Topo = 0;
    const tipos = new Set<string>();
    for (const fixture of sends) {
      const parsed = parseGoMessageEvent(fixture.data);
      expect(parsed, fixture.arquivo).not.toBeNull();
      if (!parsed) continue;
      okParse += 1;
      expect(parsed.fromMe, fixture.arquivo).toBe(true);
      expect(parsed.messageId, fixture.arquivo).toBeTruthy();
      expect(parsed.body.length, fixture.arquivo).toBeGreaterThan(0);
      tipos.add(parsed.type);

      if (parsed.type === "image" || parsed.type === "video" || parsed.type === "sticker") {
        const midia = extrairMidiaGoDeMessageObj(parsed.messageObj);
        expect(midia, fixture.arquivo).not.toBeNull();
        if (typeof (parsed.messageObj as { base64?: unknown }).base64 === "string") {
          comBase64Topo += 1;
          expect(midia!.base64, fixture.arquivo).toBeTruthy();
        }
      }
    }
    expect(okParse).toBe(sends.length);
    expect(tipos.size).toBeGreaterThan(0);
    // Corpus atual: pelo menos um SendMessage com base64 no topo (imagem).
    if (tipos.has("image")) {
      expect(comBase64Topo).toBeGreaterThan(0);
    }
  });

  it("4) PushName / LabelAssociation / Disconnected / QRTimeout", () => {
    const push = fixtures.find((f) => f.event === "PushName");
    if (push) {
      expect(
        parseGoPushName(push.data)?.newPushName || parseGoPushName(push.data)?.jid,
      ).toBeTruthy();
    }

    const labels = fixtures.filter((f) => f.event === "LabelAssociationChat");
    for (const fixture of labels.slice(0, 5)) {
      expect(parseGoLabelAssociation(fixture.data)).not.toBeNull();
    }

    const disc = fixtures.find((f) => f.event === "Disconnected");
    if (disc) {
      expect(parseGoDisconnectedEvent(disc.payload)).toBe("close");
      expect(parseConnectionUpdateWebhook(disc.payload as never)).toBe("close");
    }

    const qrTimeout = fixtures.find((f) => f.event === "QRTimeout");
    if (qrTimeout) {
      expect(parseGoQrTimeout(qrTimeout.data)).toBe("close");
    }
  });

  it("5) eventos novos tipados quando presentes no corpus", () => {
    const labelEdit = fixtures.find((f) => f.event === "LabelEdit");
    if (labelEdit) expect(parseGoLabelEdit(labelEdit.data)?.labelId).toBeTruthy();

    const contact = fixtures.find((f) => f.event === "Contact");
    if (contact) expect(parseGoContact(contact.data)?.jid).toBeTruthy();

    const picture = fixtures.find((f) => f.event === "Picture");
    if (picture) expect(parseGoPicture(picture.data)?.jid).toBeTruthy();

    const joined = fixtures.find((f) => f.event === "JoinedGroup");
    if (joined) expect(parseGoJoinedGroup(joined.data)?.jid.endsWith("@g.us")).toBe(true);

    const groupInfo = fixtures.find((f) => f.event === "GroupInfo");
    if (groupInfo) expect(parseGoGroupInfo(groupInfo.data)?.jid.endsWith("@g.us")).toBe(true);
  });

  it("6) LID → telefone canonico nas Messages @lid (quando Alt presente)", () => {
    const lidMessages = fixtures.filter((f) => {
      if (f.event !== "Message") return false;
      const info = f.data.Info as Record<string, unknown> | undefined;
      return String(info?.Chat ?? "").endsWith("@lid");
    });
    if (lidMessages.length === 0) return;

    let comTelefone = 0;
    for (const fixture of lidMessages) {
      const info = fixture.data.Info as Record<string, unknown>;
      const tel = telefoneExibicaoDeInfo(info);
      if (tel) {
        comTelefone += 1;
        expect(resolverIdExternoCanonicoGo(info)).toMatch(/@s\.whatsapp\.net$/);
      }
    }
    expect(comTelefone).toBeGreaterThan(0);
  });
});
