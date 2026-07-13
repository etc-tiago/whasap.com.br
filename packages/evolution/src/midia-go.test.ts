/**
 * Extração de mídia GO — shape real SendMessage com base64 no topo do Message.
 */
import { describe, expect, it } from "vitest";

import { buscarFixtureWebhookGo } from "./fixtures/carregar-fixtures-webhook-go";
import { extrairMidiaGoDeMessageObj } from "./midia-go";
import {
  parseGoMessageEvent,
  resolverIdExternoCanonicoGo,
  telefoneExibicaoDeInfo,
} from "./webhook-go";

describe("extrairMidiaGoDeMessageObj", () => {
  it("1) SendMessage imagem: base64 no topo do Message", () => {
    const fixture = buscarFixtureWebhookGo("send-message-image-inline-base64.json")!;
    const data = fixture.payload.data as Record<string, unknown>;
    const parsed = parseGoMessageEvent(data);
    expect(parsed?.type).toBe("image");
    expect(parsed?.fromMe).toBe(true);
    expect(parsed?.isGroup).toBe(true);
    expect(parsed?.body).toMatch(/agendamento/i);

    const midia = extrairMidiaGoDeMessageObj(parsed!.messageObj);
    expect(midia).not.toBeNull();
    expect(midia!.type).toBe("image");
    expect(midia!.mimeType).toBe("image/png");
    expect(midia!.base64).toBeTruthy();
    expect(midia!.base64!.length).toBeGreaterThan(20);
    // Confirma que veio do topo, não de imageMessage.base64
    expect((parsed!.messageObj as { base64?: string }).base64).toBe(midia!.base64);
  });

  it("2) texto sem mídia => null", () => {
    expect(
      extrairMidiaGoDeMessageObj({
        conversation: "oi",
      }),
    ).toBeNull();
  });

  it("3) preferencia base64 da parte sobre o topo", () => {
    const midia = extrairMidiaGoDeMessageObj({
      base64: "TOPO",
      imageMessage: { caption: "c", mimetype: "image/jpeg", base64: "PARTE" },
    });
    expect(midia?.base64).toBe("PARTE");
  });
});

describe("fixtures corpus derivados (grupo quoted + fromMe lid)", () => {
  it("4) Message grupo com isQuoted / quoted no envelope", () => {
    const fixture = buscarFixtureWebhookGo("message-group-quoted.json")!;
    const data = fixture.payload.data as Record<string, unknown>;
    const parsed = parseGoMessageEvent(data);
    expect(parsed?.isGroup).toBe(true);
    expect(parsed?.type).toBe("text");
    expect(parsed?.body).toBe("Isso");
    expect(data.isQuoted).toBe(true);
    expect((data.quoted as { stanzaID?: string } | undefined)?.stanzaID).toBeTruthy();
  });

  it("5) fromMe @lid usa RecipientAlt como telefone canonico", () => {
    const fixture = buscarFixtureWebhookGo("message-fromme-lid-recipient-alt.json")!;
    const data = fixture.payload.data as Record<string, unknown>;
    const info = data.Info as Record<string, unknown>;
    expect(String(info.Chat)).toMatch(/@lid$/);
    expect(info.IsFromMe).toBe(true);
    expect(telefoneExibicaoDeInfo(info)).toBe("5511910380081");
    expect(resolverIdExternoCanonicoGo(info)).toBe("5511910380081@s.whatsapp.net");
    expect(parseGoMessageEvent(data)?.fromMe).toBe(true);
  });
});
