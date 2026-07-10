import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import {
  parseGoDisconnectedEvent,
  parseConnectionUpdateWebhook,
} from "./connection-state";
import {
  parseGoButtonClick,
  parseGoLabelAssociation,
  parseGoMessageEvent,
  parseGoPushName,
  parseGoReceipt,
  resolverIdExternoCanonicoGo,
  telefoneExibicaoDeInfo,
} from "./webhook-go";

const PASTA_R2 = join(
  import.meta.dirname,
  "../../r2-sync/json/webhook/evo/unknown/2026-07-10",
);

type EnvelopeR2 = {
  receivedAt: string;
  meta: Record<string, string>;
  raw: string;
};

function carregarFixturesR2(): Array<{
  arquivo: string;
  payload: Record<string, unknown>;
}> {
  return readdirSync(PASTA_R2)
    .filter((nome) => nome.endsWith(".json"))
    .sort()
    .map((arquivo) => {
      const envelope = JSON.parse(readFileSync(join(PASTA_R2, arquivo), "utf8")) as EnvelopeR2;
      return {
        arquivo,
        payload: JSON.parse(envelope.raw) as Record<string, unknown>,
      };
    });
}

describe("matriz R2 evo (42 fixtures)", () => {
  const fixtures = carregarFixturesR2();

  it("carrega os 42 arquivos locais", () => {
    expect(fixtures).toHaveLength(42);
  });

  it("parseia 24/24 Messages sem null", () => {
    const messages = fixtures.filter((f) => f.payload.event === "Message");
    expect(messages).toHaveLength(24);

    const tipos = new Set<string>();
    for (const fixture of messages) {
      const data = fixture.payload.data as Record<string, unknown>;
      const parsed = parseGoMessageEvent(data);
      expect(parsed, fixture.arquivo).not.toBeNull();
      expect(parsed!.body.length).toBeGreaterThan(0);
      expect(parsed!.messageId).toBeTruthy();
      tipos.add(parsed!.type);

      const info = data.Info as Record<string, unknown>;
      const canonico = resolverIdExternoCanonicoGo(info);
      expect(canonico).toBeTruthy();
      expect(telefoneExibicaoDeInfo(info)).toBeTruthy();
    }

    expect(tipos.has("text")).toBe(true);
    expect(tipos.has("sticker")).toBe(true);
    expect(tipos.has("reaction")).toBe(true);
    expect(tipos.has("poll")).toBe(true);
    expect(tipos.has("interactive")).toBe(true);
    expect(tipos.has("contacts")).toBe(true);
    expect(tipos.has("event")).toBe(true);
  });

  it("resolve LID → telefone canônico nas Messages @lid", () => {
    const lidMessages = fixtures.filter((f) => {
      if (f.payload.event !== "Message") return false;
      const info = (f.payload.data as Record<string, unknown>).Info as Record<string, unknown>;
      return String(info.Chat ?? "").endsWith("@lid");
    });

    expect(lidMessages.length).toBeGreaterThanOrEqual(9);

    for (const fixture of lidMessages) {
      const info = (fixture.payload.data as Record<string, unknown>).Info as Record<
        string,
        unknown
      >;
      expect(resolverIdExternoCanonicoGo(info)).toMatch(/@s\.whatsapp\.net$/);
      expect(telefoneExibicaoDeInfo(info)).toMatch(/^\d+$/);
    }
  });

  it("parseia Receipts (Type vazio retorna receipt sem leitura)", () => {
    const receipts = fixtures.filter((f) => f.payload.event === "Receipt");
    expect(receipts).toHaveLength(12);

    let comType = 0;
    let semType = 0;
    for (const fixture of receipts) {
      const parsed = parseGoReceipt(
        fixture.payload.data as Record<string, unknown>,
        fixture.payload.state as string | undefined,
      );
      expect(parsed, fixture.arquivo).not.toBeNull();
      expect(parsed!.messageIds.length).toBeGreaterThan(0);
      if (parsed!.type) comType += 1;
      else semType += 1;
    }
    expect(comType + semType).toBe(12);
  });

  it("parseia ButtonClick com flow_token", () => {
    const fixture = fixtures.find((f) => f.payload.event === "ButtonClick")!;
    expect(fixture).toBeTruthy();
    const parsed = parseGoButtonClick(fixture.payload.data as Record<string, unknown>);
    expect(parsed?.flowToken).toBeTruthy();
    expect(parsed?.idempotencyKey).toBe(parsed?.flowToken);
  });

  it("parseia PushName com JID/LID", () => {
    const fixture = fixtures.find((f) => f.payload.event === "PushName")!;
    expect(fixture).toBeTruthy();
    const parsed = parseGoPushName(fixture.payload.data as Record<string, unknown>);
    expect(parsed?.jid).toBeTruthy();
    expect(parsed?.newPushName || parsed?.oldPushName).toBeTruthy();
  });

  it("parseia LabelAssociationChat", () => {
    const labels = fixtures.filter((f) => f.payload.event === "LabelAssociationChat");
    expect(labels).toHaveLength(3);
    for (const fixture of labels) {
      const parsed = parseGoLabelAssociation(fixture.payload.data as Record<string, unknown>);
      expect(parsed, fixture.arquivo).not.toBeNull();
      expect(parsed!.labelId).toBeTruthy();
      expect(parsed!.jid).toBeTruthy();
    }
  });

  it("parseia Disconnected como close", () => {
    const fixture = fixtures.find((f) => f.payload.event === "Disconnected")!;
    expect(fixture).toBeTruthy();
    expect(fixture.payload.data).toEqual({});
    expect(parseGoDisconnectedEvent(fixture.payload)).toBe("close");
    expect(parseConnectionUpdateWebhook(fixture.payload as never)).toBe("close");
  });
});
