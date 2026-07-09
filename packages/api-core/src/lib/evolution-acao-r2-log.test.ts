import { describe, expect, it } from "vitest";

import {
  buildAcaoEvolutionLogKey,
  derivarEvolutionAcaoLog,
  prepararEvolutionAcaoLogEntry,
  redigirEvolutionLogPayload,
} from "./evolution-acao-r2-log";

describe("buildAcaoEvolutionLogKey", () => {
  it("monta chave acao/{tipo}/{date}/{time}.{uuid}.json", () => {
    const at = new Date("2026-07-09T14:30:45.123Z");
    const key = buildAcaoEvolutionLogKey("instance_qr", at);
    expect(key).toMatch(/^acao\/instance_qr\/2026-07-09\/14-30-45\.[0-9a-f-]{36}\.json$/);
  });

  it("monta chave com instanciaUuid quando informado", () => {
    const at = new Date("2026-07-09T14:30:45.123Z");
    const uuid = "7fc7a78a-141b-49b9-9816-f5d0e9e4be47";
    const key = buildAcaoEvolutionLogKey("instance_status", at, uuid);
    expect(key).toMatch(
      new RegExp(`^acao/${uuid}/instance_status/2026-07-09/14-30-45\\.[0-9a-f-]{36}\\.json$`),
    );
  });

  it("sanitiza tipo inválido", () => {
    const key = buildAcaoEvolutionLogKey("foo bar!", new Date("2026-01-01T00:00:00.000Z"));
    expect(key.startsWith("acao/foo_bar_/2026-01-01/")).toBe(true);
  });
});

describe("redigirEvolutionLogPayload", () => {
  it("redige tokens e trunca base64", () => {
    const base64 = "A".repeat(300);
    const out = redigirEvolutionLogPayload({
      token: "secret",
      accessToken: "meta-secret",
      qr: base64,
      nested: { evolucaoToken: "nested-secret" },
    }) as Record<string, unknown>;

    expect(out.token).toBe("[redacted]");
    expect(out.accessToken).toBe("[redacted]");
    expect(out.nested).toEqual({ evolucaoToken: "[redacted]" });
    expect(out.qr).toEqual({ length: 300, preview: "A".repeat(80) });
  });
});

describe("derivarEvolutionAcaoLog", () => {
  it("deriva estado close quando Connected false", () => {
    const derivado = derivarEvolutionAcaoLog("instance_status", {
      data: { Connected: false, LoggedIn: false, Name: "" },
      message: "success",
    });
    expect(derivado).toEqual({ estado: "close", conectado: false });
  });
});

describe("prepararEvolutionAcaoLogEntry", () => {
  it("aplica redação nos corpos", () => {
    const entry = prepararEvolutionAcaoLogEntry({
      tipo: "instance_create",
      method: "POST",
      path: "/instance/create",
      status: 200,
      durationMs: 42,
      requestBody: { token: "abc" },
      responseBody: { token: "def" },
    });

    expect(entry.requestBody).toEqual({ token: "[redacted]" });
    expect(entry.responseBody).toEqual({ token: "[redacted]" });
    expect(entry.at).toBeTruthy();
  });
});
