import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { classificarErroDownloadMedia, normalizarDownloadMediaBody } from "./client-go";
import {
  cdnMidiaPresumivelmenteExpirada,
  coletarCaminhosMidiaWa,
  extrairTimestampsOe,
} from "./download-media-cdn";

const PASTA = join(import.meta.dirname, "fixtures/acao");

function carregar(nome: string) {
  return JSON.parse(readFileSync(join(PASTA, nome), "utf8")) as {
    status: number;
    body: unknown;
  };
}

describe("downloadMedia normalizacao / erros", () => {
  it("1) sucesso unwrap data.base64", () => {
    const fixture = carregar("downloadmedia-200.json");
    const n = normalizarDownloadMediaBody(fixture.body);
    expect(n?.base64).toMatch(/^data:/);
    expect(n?.mimetype).toBeTruthy();
  });

  it("2) 401 => unauthorized", () => {
    const fixture = carregar("downloadmedia-401.json");
    expect(classificarErroDownloadMedia(fixture.status, fixture.body)).toBe("unauthorized");
  });

  it("3) 500 Failed to download audio … 403 => forbidden", () => {
    const fixture = carregar("downloadmedia-500.json");
    expect(classificarErroDownloadMedia(fixture.status, fixture.body)).toBe("forbidden");
  });

  it("4) body sem base64 retorna null", () => {
    expect(normalizarDownloadMediaBody({ message: "success", data: {} })).toBeNull();
  });

  it("5) flat base64 aceito", () => {
    const n = normalizarDownloadMediaBody({ base64: "data:image/png;base64,aaa" });
    expect(n).toEqual({
      base64: "data:image/png;base64,aaa",
      mimetype: "image/png",
      timestamp: undefined,
    });
  });

  it("6) 500 Failed to download sticker … 403 => forbidden", () => {
    const fixture = carregar("downloadmedia-500-sticker.json");
    expect(classificarErroDownloadMedia(fixture.status, fixture.body)).toBe("forbidden");
  });
});

describe("downloadMedia CDN oe=", () => {
  const stickerExpirado = {
    stickerMessage: {
      URL: "https://web.whatsapp.net",
      directPath: "/v/t62.15575-24/x.enc?ccb=11-4&oh=01_Q5Aa&oe=68E8C185&_nc_sid=5e03e0",
      mimetype: "image/webp",
    },
  };

  it("7) extrai oe hex de directPath", () => {
    const caminhos = coletarCaminhosMidiaWa(stickerExpirado);
    expect(caminhos.some((c) => c.includes("oe="))).toBe(true);
    expect(extrairTimestampsOe(...caminhos)).toContain(0x68e8c185);
  });

  it("8) oe expirado => cdnMidiaPresumivelmenteExpirada", () => {
    // oe=68E8C185 → 2025-10-10; referência 2026-07-13
    expect(
      cdnMidiaPresumivelmenteExpirada(stickerExpirado, Date.parse("2026-07-13T20:11:29Z")),
    ).toBe(true);
  });

  it("9) sem oe => nao presume expirado", () => {
    expect(
      cdnMidiaPresumivelmenteExpirada({
        audioMessage: { URL: "https://mmg.whatsapp.net/v/t62/x.enc", mimetype: "audio/ogg" },
      }),
    ).toBe(false);
  });

  it("10) oe futuro => nao expirado", () => {
    const futuro = {
      audioMessage: {
        URL: "https://mmg.whatsapp.net/v/x.enc?oe=7FFFFFFF",
        directPath: "/v/x.enc?oe=7FFFFFFF",
      },
    };
    expect(cdnMidiaPresumivelmenteExpirada(futuro, Date.parse("2026-07-13T00:00:00Z"))).toBe(false);
  });
});
