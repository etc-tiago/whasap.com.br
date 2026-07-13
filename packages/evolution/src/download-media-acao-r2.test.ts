/**
 * Matriz downloadmedia contra corpus real em `packages/r2-sync/json/acao/evo`.
 * Garante classificação forbidden (CDN 403 via GO 500) e detecção de oe= expirado.
 */
import { describe, expect, it } from "vitest";

import { classificarErroDownloadMedia } from "./client-go";
import {
  cdnMidiaPresumivelmenteExpirada,
  coletarCaminhosMidiaWa,
  extrairTimestampsOe,
} from "./download-media-cdn";
import { carregarAcaoR2, corpusAcaoR2Disponivel } from "./fixtures/carregar-acao-r2";

const corpusOk = corpusAcaoR2Disponivel("message_downloadmedia");

describe.skipIf(!corpusOk)("downloadmedia corpus R2 (acao)", () => {
  const fixtures = corpusOk ? carregarAcaoR2({ acao: "message_downloadmedia" }) : [];

  it("1) corpus message_downloadmedia não vazio", () => {
    expect(fixtures.length).toBeGreaterThanOrEqual(1);
  });

  it("2) envelope canônico (at/provedor/acao/request/response/meta)", () => {
    for (const f of fixtures) {
      const e = f.envelope;
      expect(e.at, f.arquivo).toBeTruthy();
      expect(e.provedor, f.arquivo).toBe("evo");
      expect(e.acao, f.arquivo).toBe("message_downloadmedia");
      expect(e.request?.url, f.arquivo).toMatch(/\/message\/downloadmedia$/);
      expect(e.request?.tipo, f.arquivo).toBe("POST");
      expect(e.response, f.arquivo).toBeTruthy();
      expect(e.meta?.instanciaUuid, f.arquivo).toBeTruthy();
    }
  });

  it("3) worker history-sync + rpc media.download", () => {
    for (const f of fixtures) {
      expect(f.envelope.meta.worker, f.arquivo).toBe("whasap-history-sync");
      expect(f.envelope.meta.rpc, f.arquivo).toBe("webhook.media.download");
    }
  });

  it("4) 500 Failed to download … 403 => forbidden (sticker e audio)", () => {
    for (const f of fixtures) {
      const { status, body } = f.envelope.response;
      expect(status, f.arquivo).toBe(500);
      expect(classificarErroDownloadMedia(status ?? 0, body), f.arquivo).toBe("forbidden");
      const texto =
        body && typeof body === "object" && "error" in body
          ? String((body as { error?: unknown }).error ?? "")
          : "";
      expect(texto, f.arquivo).toMatch(/Failed to download/i);
      expect(texto, f.arquivo).toMatch(/\b403\b/);
    }
  });

  it("5) request.body.message tem bloco *Message com caminho CDN", () => {
    for (const f of fixtures) {
      const body = f.envelope.request.body as { message?: unknown } | undefined;
      const message = body?.message;
      const caminhos = coletarCaminhosMidiaWa(message);
      expect(caminhos.length, f.arquivo).toBeGreaterThan(0);
      const tipos = message && typeof message === "object" ? Object.keys(message as object) : [];
      expect(
        tipos.some((k) => /Message$/i.test(k)),
        `${f.arquivo} tipos=${tipos.join(",")}`,
      ).toBe(true);
    }
  });

  it("6) oe= do corpus está expirado em relação a envelope.at", () => {
    for (const f of fixtures) {
      const body = f.envelope.request.body as { message?: unknown };
      const agora = Date.parse(f.envelope.at);
      expect(Number.isFinite(agora), f.arquivo).toBe(true);
      expect(cdnMidiaPresumivelmenteExpirada(body.message, agora), f.arquivo).toBe(true);
      expect(
        extrairTimestampsOe(...coletarCaminhosMidiaWa(body.message)).length,
        f.arquivo,
      ).toBeGreaterThan(0);
    }
  });
});
