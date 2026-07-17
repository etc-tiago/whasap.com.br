import { describe, expect, it } from "vitest";

import { buscarFixtureWebhookMeta } from "./fixtures/carregar-fixtures-webhook-meta";
import {
  metaMessageTemMidia,
  metaMidiaDeMetadados,
  parseMetaMessage,
  parseMetaStatus,
  parseMetaWebhook,
  resolverIdExternoCanonicoMeta,
} from "./webhook-cloud";

describe("parseMetaWebhook", () => {
  it("carrega fixtures meta-cloud", () => {
    const fixture = buscarFixtureWebhookMeta("message-text-inbound.json");
    expect(fixture?.payload.object).toBe("whatsapp_business_account");
  });

  it("normaliza change com mensagem text e user_id", () => {
    const fixture = buscarFixtureWebhookMeta("message-text-inbound.json")!;
    const changes = parseMetaWebhook(fixture.payload);
    expect(changes).toHaveLength(1);
    expect(changes[0]!.phoneNumberId).toBe("27681414235104944");
    expect(changes[0]!.messages).toHaveLength(1);
    expect(changes[0]!.contacts[0]?.name).toBe("Kerry Fisher");
    expect(changes[0]!.contacts[0]?.userId).toBe("US.1020334360914919");
  });

  it("normaliza change com status", () => {
    const fixture = buscarFixtureWebhookMeta("status-delivered.json")!;
    const changes = parseMetaWebhook(fixture.payload);
    expect(changes[0]!.statuses[0]?.status).toBe("delivered");
  });
});

describe("parseMetaMessage", () => {
  it("parseia text inbound com from_user_id", () => {
    const fixture = buscarFixtureWebhookMeta("message-text-inbound.json")!;
    const msg = parseMetaWebhook(fixture.payload)[0]!.messages[0]!;
    const parsed = parseMetaMessage(msg);
    expect(parsed?.type).toBe("text");
    expect(parsed?.body).toBe("Olá, preciso de ajuda!");
    expect(parsed?.phone).toBe("16315551234");
    expect(parsed?.metadados.fromUserId).toBe("US.1020334360914919");
  });

  it("parseia image com metadados de mídia", () => {
    const fixture = buscarFixtureWebhookMeta("message-image-inbound.json")!;
    const msg = parseMetaWebhook(fixture.payload)[0]!.messages[0]!;
    const parsed = parseMetaMessage(msg);
    expect(parsed?.type).toBe("image");
    expect(metaMessageTemMidia(parsed!.type)).toBe(true);
    const media = metaMidiaDeMetadados(parsed!.metadados);
    expect(media?.mediaId).toBe("media-image-001");
    expect(media?.mimeType).toBe("image/jpeg");
  });

  it("parseia interactive button_reply", () => {
    const fixture = buscarFixtureWebhookMeta("message-interactive-button.json")!;
    const msg = parseMetaWebhook(fixture.payload)[0]!.messages[0]!;
    const parsed = parseMetaMessage(msg);
    expect(parsed?.type).toBe("interactive");
    expect(parsed?.body).toBe("Confirmar pedido");
  });

  it("parseia unsupported", () => {
    const fixture = buscarFixtureWebhookMeta("message-unsupported.json")!;
    const msg = parseMetaWebhook(fixture.payload)[0]!.messages[0]!;
    const parsed = parseMetaMessage(msg);
    expect(parsed?.type).toBe("unsupported");
    expect(parsed?.metadados.errors).toBeTruthy();
  });

  it("parseia unsupported do corpus com from_user_id e contact.user_id", () => {
    const fixture = buscarFixtureWebhookMeta("message-unsupported-userid.json")!;
    const change = parseMetaWebhook(fixture.payload)[0]!;
    expect(change.contacts[0]?.userId).toMatch(/^BR\./);
    const parsed = parseMetaMessage(change.messages[0]!);
    expect(parsed?.type).toBe("unsupported");
    expect(parsed?.metadados.fromUserId).toMatch(/^BR\./);
    expect(parsed?.metadados.errors).toBeTruthy();
  });
});

describe("parseMetaStatus", () => {
  it("parseia delivered com pricing PMP", () => {
    const fixture = buscarFixtureWebhookMeta("status-delivered.json")!;
    const status = parseMetaWebhook(fixture.payload)[0]!.statuses[0]!;
    const parsed = parseMetaStatus(status);
    expect(parsed?.status).toBe("delivered");
    expect(parsed?.externalId).toContain("wamid.");
    expect(parsed?.recipientUserId).toBe("US.1281832397362517");
    expect(parsed?.pricing?.pricingModel).toBe("PMP");
    expect(parsed?.pricing?.category).toBe("service");
    expect(parsed?.pricing?.type).toBe("free_customer_service");
    expect(parsed?.pricing?.billable).toBe(false);
  });

  it("parseia read", () => {
    const fixture = buscarFixtureWebhookMeta("status-read.json")!;
    const status = parseMetaWebhook(fixture.payload)[0]!.statuses[0]!;
    expect(parseMetaStatus(status)?.status).toBe("read");
  });
});

describe("resolverIdExternoCanonicoMeta", () => {
  it("monta JID @s.whatsapp.net", () => {
    expect(resolverIdExternoCanonicoMeta("16315551234")).toBe("16315551234@s.whatsapp.net");
  });
});
