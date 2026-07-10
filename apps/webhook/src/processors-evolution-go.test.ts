import { describe, expect, test } from "bun:test";

import { buscarFixtureWebhookGo } from "../../../packages/evolution/src/fixtures/carregar-fixtures-webhook-go";
import {
  parseGoButtonClick,
  parseGoMessageEvent,
  parseGoPairSuccess,
  parseGoPushName,
  parseGoReceipt,
  parseConnectionUpdateWebhook,
  parseGoDisconnectedEvent,
  receiptIndicaLeitura,
  resolverIdExternoCanonicoGo,
  resolverInstanciaWebhookGo,
  telefoneExibicaoDeInfo,
} from "@whasap/evolution";

describe("processors evolution GO (fixtures)", () => {
  test("Message inbound extrai chat e corpo", () => {
    const fixture = buscarFixtureWebhookGo("message-inbound.json")!;
    const resolved = resolverInstanciaWebhookGo(fixture.payload as never);
    expect(resolved.instanceName).toBe("whasap-c330073d");

    const parsed = parseGoMessageEvent(fixture.payload.data as Record<string, unknown>);
    expect(parsed).not.toBeNull();
    expect(parsed!.fromMe).toBe(false);
    expect(parsed!.body.length).toBeGreaterThan(0);
    expect(parsed!.messageId).toBeTruthy();
  });

  test("SendMessage outbound é fromMe", () => {
    const fixture = buscarFixtureWebhookGo("send-message-outbound.json")!;
    const parsed = parseGoMessageEvent(fixture.payload.data as Record<string, unknown>);
    expect(parsed?.fromMe).toBe(true);
  });

  test("PairSuccess mapeia conexão aberta", () => {
    const fixture = buscarFixtureWebhookGo("pair-success.json")!;
    expect(parseGoPairSuccess(fixture.payload.data as Record<string, unknown>)).toBe("open");
  });

  test("Disconnected mapeia sessão fechada", () => {
    const fixture = buscarFixtureWebhookGo("disconnected.json")!;
    expect(fixture.payload.event).toBe("Disconnected");
    expect(parseGoDisconnectedEvent(fixture.payload)).toBe("close");
    expect(parseConnectionUpdateWebhook(fixture.payload as never)).toBe("close");

    const resolved = resolverInstanciaWebhookGo(fixture.payload as never);
    expect(resolved.instanceName).toBe("whasap-c330073d");
    expect(resolved.instanceId).toBe("c330073d-6d17-4fa3-a8cb-a7c1f5eaacdf");
  });

  test("Message LID monta identidade canônica e telefone de exibição", () => {
    const fixture = buscarFixtureWebhookGo("message-reaction.json")!;
    const data = fixture.payload.data as Record<string, unknown>;
    const info = data.Info as Record<string, unknown>;
    const parsed = parseGoMessageEvent(data);

    expect(parsed).not.toBeNull();
    expect(String(info.Chat)).toContain("@lid");
    expect(resolverIdExternoCanonicoGo(info)).toMatch(/@s\.whatsapp\.net$/);
    expect(telefoneExibicaoDeInfo(info)).toMatch(/^\d{10,}$/);

    const ingestShape = {
      idExternoLinha: String(info.Chat),
      idExternoCanonico: resolverIdExternoCanonicoGo(info),
      phone: telefoneExibicaoDeInfo(info),
      provedor: "evo" as const,
      type: parsed!.type,
      body: parsed!.body,
    };
    expect(ingestShape.idExternoLinha).not.toBe(ingestShape.idExternoCanonico);
    expect(ingestShape.phone).toBe("554688043494");
    expect(ingestShape.type).toBe("reaction");
  });

  test("ButtonClick gera chave de idempotência por flow_token", () => {
    const fixture = buscarFixtureWebhookGo("button-click-flow.json")!;
    const parsed = parseGoButtonClick(fixture.payload.data as Record<string, unknown>);
    expect(parsed?.idempotencyKey).toBe(parsed?.flowToken);
    expect(parsed?.flowToken).toBeTruthy();
  });

  test("PushName atualiza nome por JID/LID", () => {
    const fixture = buscarFixtureWebhookGo("push-name-lid.json")!;
    const parsed = parseGoPushName(fixture.payload.data as Record<string, unknown>);
    expect(parsed?.jid).toContain("@lid");
    expect(parsed?.jidAlt).toContain("@s.whatsapp.net");
    expect(parsed?.newPushName).toBeTruthy();
  });

  test("Receipt read indica leitura", () => {
    const fixture = buscarFixtureWebhookGo("receipt-read.json")!;
    const receipt = parseGoReceipt(
      fixture.payload.data as Record<string, unknown>,
      fixture.payload.state as string,
    );
    expect(receipt).not.toBeNull();
    expect(receiptIndicaLeitura(receipt!)).toBe(true);
  });

  test("tipos especiais parseiam (sticker/reaction/poll/interactive)", () => {
    const cases = [
      ["message-sticker.json", "sticker"],
      ["message-reaction.json", "reaction"],
      ["message-poll.json", "poll"],
      ["message-interactive-flow.json", "interactive"],
    ] as const;

    for (const [arquivo, type] of cases) {
      const fixture = buscarFixtureWebhookGo(arquivo)!;
      const parsed = parseGoMessageEvent(fixture.payload.data as Record<string, unknown>);
      expect(parsed?.type).toBe(type);
    }
  });
});
