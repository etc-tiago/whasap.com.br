import { describe, expect, it } from "vitest";

import {
  parseConnectionUpdateWebhook,
  parseGoConnectionState,
  parseGoQrResponse,
  type EvolutionGoStatusResponse,
} from "./connection-state";

describe("parseGoConnectionState", () => {
  it("mantém strings Baileys", () => {
    expect(parseGoConnectionState({ state: "open" })).toBe("open");
    expect(parseGoConnectionState({ data: { state: "close" } })).toBe("close");
    expect(parseGoConnectionState({ status: "connecting" })).toBe("connecting");
  });

  it("mapeia Connected/LoggedIn do Evolution GO", () => {
    expect(
      parseGoConnectionState({
        data: { Connected: true, LoggedIn: true },
      }),
    ).toBe("open");

    expect(
      parseGoConnectionState({
        data: { Connected: true, LoggedIn: false },
      }),
    ).toBe("connecting");

    expect(
      parseGoConnectionState({
        data: { Connected: false, LoggedIn: false },
      }),
    ).toBe("close");
  });

  it("aceita booleans em camelCase", () => {
    expect(parseGoConnectionState({ data: { connected: true, loggedIn: true } })).toBe("open");
  });

  it("usa connected flat como fallback", () => {
    expect(parseGoConnectionState({ connected: true })).toBe("open");
  });

  it("default connecting quando formato desconhecido", () => {
    expect(parseGoConnectionState({ message: "success" } as EvolutionGoStatusResponse)).toBe(
      "connecting",
    );
  });
});

describe("parseConnectionUpdateWebhook", () => {
  it("lê state Baileys", () => {
    expect(parseConnectionUpdateWebhook({ data: { state: "open" } })).toBe("open");
    expect(parseConnectionUpdateWebhook({ data: { state: "close" } })).toBe("close");
  });

  it("lê booleans GO", () => {
    expect(
      parseConnectionUpdateWebhook({ data: { Connected: true, LoggedIn: true } }),
    ).toBe("open");
  });

  it("retorna null sem sinal reconhecível", () => {
    expect(parseConnectionUpdateWebhook({ data: {} })).toBeNull();
  });
});

describe("parseGoQrResponse", () => {
  it("divide campo qr pipe", () => {
    expect(parseGoQrResponse({ qr: "aW1n|1234-5678" })).toEqual({
      base64: "aW1n",
      pairingCode: "1234-5678",
    });
  });

  it("lê data.qrcode e pairingCode", () => {
    expect(
      parseGoQrResponse({
        data: { qrcode: "abc", pairingCode: "9999" },
      }),
    ).toEqual({ base64: "abc", pairingCode: "9999" });
  });

  it("lê code como pairing", () => {
    expect(parseGoQrResponse({ code: "ABCD" })).toEqual({
      base64: null,
      pairingCode: "ABCD",
    });
  });
});
