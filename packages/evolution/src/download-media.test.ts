import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import {
  classificarErroDownloadMedia,
  normalizarDownloadMediaBody,
} from "./client-go";

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

  it("3) 500 Failed to download … 403 => forbidden", () => {
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
});
