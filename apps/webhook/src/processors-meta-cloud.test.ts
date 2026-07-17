import { describe, expect, it } from "bun:test";

import { buscarFixtureWebhookMeta } from "../../../packages/meta/src/fixtures/carregar-fixtures-webhook-meta";
import {
  parseMetaMessage,
  parseMetaStatus,
  parseMetaWebhook,
  resolverIdExternoCanonicoMeta,
} from "@whasap/meta";

describe("processors meta_cloud (fixtures)", () => {
  it("text inbound → params de ingestão", () => {
    const fixture = buscarFixtureWebhookMeta("message-text-inbound.json")!;
    const changes = parseMetaWebhook(fixture.payload);
    expect(changes).toHaveLength(1);

    const msg = changes[0]!.messages[0]!;
    const parsed = parseMetaMessage(msg);
    expect(parsed).not.toBeNull();

    const idExternoCanonico = resolverIdExternoCanonicoMeta(parsed!.phone);
    expect(idExternoCanonico).toBe(`${parsed!.phone}@s.whatsapp.net`);

    const ingestParams = {
      phone: parsed!.phone,
      idExternoLinha: parsed!.phone,
      idExternoCanonico,
      body: parsed!.body,
      type: parsed!.type,
      externalId: parsed!.externalId,
      provedor: "meta_cloud" as const,
    };

    expect(ingestParams.type).toBe("text");
    expect(ingestParams.body).toBe("Olá, preciso de ajuda!");
    expect(ingestParams.externalId).toContain("wamid.");
  });

  it("image inbound tem midia nos metadados", () => {
    const fixture = buscarFixtureWebhookMeta("message-image-inbound.json")!;
    const msg = parseMetaWebhook(fixture.payload)[0]!.messages[0]!;
    const parsed = parseMetaMessage(msg);
    expect(parsed?.type).toBe("image");
    expect(parsed?.metadados).toMatchObject({
      mediaId: expect.any(String),
    });
  });

  it("interactive button_reply", () => {
    const fixture = buscarFixtureWebhookMeta("message-interactive-button.json")!;
    const msg = parseMetaWebhook(fixture.payload)[0]!.messages[0]!;
    const parsed = parseMetaMessage(msg);
    expect(parsed?.type).toBe("interactive");
    expect(parsed?.body).toBeTruthy();
  });

  it("unsupported não quebra o parser", () => {
    const fixture = buscarFixtureWebhookMeta("message-unsupported.json")!;
    const msg = parseMetaWebhook(fixture.payload)[0]!.messages[0]!;
    const parsed = parseMetaMessage(msg);
    expect(parsed?.type).toBe("unsupported");
  });

  it("status delivered e read com pricing/user_id", () => {
    const delivered = buscarFixtureWebhookMeta("status-delivered.json")!;
    const read = buscarFixtureWebhookMeta("status-read.json")!;
    const deliveredParsed = parseMetaStatus(parseMetaWebhook(delivered.payload)[0]!.statuses[0]!);
    expect(deliveredParsed?.status).toBe("delivered");
    expect(deliveredParsed?.pricing?.pricingModel).toBe("PMP");
    expect(deliveredParsed?.recipientUserId).toBeTruthy();
    expect(parseMetaStatus(parseMetaWebhook(read.payload)[0]!.statuses[0]!)?.status).toBe("read");
  });

  it("text inbound carrega from_user_id e contact.user_id", () => {
    const fixture = buscarFixtureWebhookMeta("message-text-inbound.json")!;
    const change = parseMetaWebhook(fixture.payload)[0]!;
    expect(change.contacts[0]?.userId).toBeTruthy();
    const parsed = parseMetaMessage(change.messages[0]!);
    expect(parsed?.metadados.fromUserId).toBeTruthy();
  });
});
