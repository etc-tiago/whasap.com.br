/**
 * Curto-circuitos de persistirMidiaInbound (CDN oe expirado / validação).
 */
import { describe, expect, it, vi } from "vitest";

import { persistirMidiaInbound } from "./midia-inbound";

vi.mock("./evolution-env", () => ({
  getEvolutionCredentials: vi.fn(async () => {
    throw new Error("nao deveria chamar Evolution com oe expirado");
  }),
}));

vi.mock("./criar-cliente-evolution-go", () => ({
  criarClienteEvolutionGo: vi.fn(() => {
    throw new Error("nao deveria criar cliente com oe expirado");
  }),
}));

describe("persistirMidiaInbound (cdn oe)", () => {
  const env = {
    CDN_R2: { put: vi.fn() },
    CDN_HMAC_SECRET: "segredo-teste-hmac-cdn",
  } as never;

  const db = {
    update: vi.fn(() => ({
      set: vi.fn(() => ({
        where: vi.fn(async () => undefined),
      })),
    })),
  } as never;

  it("1) oe expirado falha soft sem chamar Evolution", async () => {
    await expect(
      persistirMidiaInbound(env, db, {
        provider: "evo",
        instanceUuid: "4fdb1e21-d5ad-4404-8ccb-c153fa8de5e5",
        messageId: 1,
        externalId: "STICKER1",
        type: "sticker",
        instanceToken: "tok",
        origem: "history_sync",
        messageKey: { remoteJid: "5511@s.whatsapp.net", fromMe: false, id: "STICKER1" },
        waMessage: {
          stickerMessage: {
            URL: "https://web.whatsapp.net",
            directPath: "/v/t62.15575-24/x.enc?oe=68E8C185&_nc_sid=5e03e0",
            mimetype: "image/webp",
          },
        },
      }),
    ).rejects.toThrow(/cdn-oe-expired/);
  });

  it("2) sem waMessage/base64 falha cedo", async () => {
    await expect(
      persistirMidiaInbound(env, db, {
        provider: "evo",
        instanceUuid: "u",
        messageId: 2,
        externalId: "X",
        type: "image",
        instanceToken: "tok",
        messageKey: { remoteJid: "a@s.whatsapp.net", fromMe: false, id: "X" },
      }),
    ).rejects.toThrow(/sem waMessage/);
  });

  it("3) base64 inline no waMessage grava no CDN sem Evolution", async () => {
    const put = vi.fn(async () => undefined);
    const envInline = {
      CDN_R2: { put },
      CDN_HMAC_SECRET: "segredo-teste-hmac-cdn",
    } as never;
    const set = vi.fn(() => ({ where: vi.fn(async () => undefined) }));
    const dbInline = { update: vi.fn(() => ({ set })) } as never;

    await persistirMidiaInbound(envInline, dbInline, {
      provider: "evo",
      instanceUuid: "4fdb1e21-d5ad-4404-8ccb-c153fa8de5e5",
      messageId: 9,
      externalId: "IMG1",
      type: "image",
      instanceToken: "tok",
      messageKey: { remoteJid: "g@g.us", fromMe: true, id: "IMG1" },
      mimeType: "image/png",
      waMessage: {
        base64:
          "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
        imageMessage: { caption: "x", mimetype: "image/png" },
      },
    });

    expect(put).toHaveBeenCalledTimes(1);
    expect(set).toHaveBeenCalled();
  });
});
