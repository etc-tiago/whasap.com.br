import { describe, expect, it, mock } from "bun:test";

import { obterQrComSessao } from "./evolution-webhook";

describe("obterQrComSessao", () => {
  it("chama connect e devolve QR na primeira tentativa", async () => {
    const connect = mock(async () => ({ message: "ok" }));
    const getQrCode = mock(async () => ({
      data: { qrcode: "data:image/png;base64,abc", pairingCode: "1234" },
    }));

    const result = await obterQrComSessao(
      { connect, getQrCode },
      { WEBHOOK_URL: "https://webhook.example" },
      { tentativas: 2, delayMs: 1 },
    );

    expect(connect).toHaveBeenCalledTimes(1);
    expect(getQrCode).toHaveBeenCalledTimes(1);
    expect(result.base64).toBe("data:image/png;base64,abc");
    expect(result.pairingCode).toBe("1234");
    expect(result.erro).toBeNull();
  });

  it("repassa getQrCode se a 1ª tentativa vier vazia", async () => {
    let calls = 0;
    const connect = mock(async () => ({ message: "ok" }));
    const getQrCode = mock(async () => {
      calls += 1;
      if (calls === 1) return { data: {} };
      return { qr: "imgBase64|PAIR-99" };
    });

    const result = await obterQrComSessao(
      { connect, getQrCode },
      { WEBHOOK_URL: "https://webhook.example" },
      { tentativas: 3, delayMs: 1 },
    );

    expect(connect).toHaveBeenCalledTimes(1);
    expect(getQrCode).toHaveBeenCalledTimes(2);
    expect(result.base64).toBe("imgBase64");
    expect(result.pairingCode).toBe("PAIR-99");
  });

  it("retorna null se QR nunca chega após connect", async () => {
    const connect = mock(async () => ({ message: "ok" }));
    const getQrCode = mock(async () => {
      throw new Error("qr unavailable");
    });

    const result = await obterQrComSessao(
      { connect, getQrCode },
      { WEBHOOK_URL: "https://webhook.example" },
      { tentativas: 2, delayMs: 1 },
    );

    expect(connect).toHaveBeenCalledTimes(1);
    expect(result.base64).toBeNull();
    expect(result.pairingCode).toBeNull();
    expect(result.erro).toContain("qr unavailable");
  });

  it("chama connect mesmo quando usado no path connecting sem QR", async () => {
    const connect = mock(async () => ({ message: "ok" }));
    const getQrCode = mock(async () => ({
      data: { qrcode: "data:image/png;base64,from-connecting" },
    }));

    const result = await obterQrComSessao(
      { connect, getQrCode },
      { WEBHOOK_URL: "https://webhook.example" },
      { tentativas: 1, delayMs: 1 },
    );

    expect(connect).toHaveBeenCalledTimes(1);
    const connectArgs = connect.mock.calls[0]?.[0] as { webhookUrl?: string };
    expect(connectArgs?.webhookUrl).toBe("https://webhook.example/evo");
    expect(result.base64).toBe("data:image/png;base64,from-connecting");
  });
});
