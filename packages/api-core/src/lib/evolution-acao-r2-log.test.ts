import { describe, expect, it } from "vitest";

import {
  buildAcaoProvedorLogKey,
  derivarEvolutionAcaoLog,
  prepararProvedorAcaoLogEntry,
  redigirProvedorLogPayload,
  redigirUrlLog,
} from "./evolution-acao-r2-log";

describe("buildAcaoProvedorLogKey", () => {
  it("monta chave acao/{provedor}/{acao}/{date}/{time}.{uuid}.json", () => {
    const at = new Date("2026-07-09T14:30:45.123Z");
    const key = buildAcaoProvedorLogKey("evo", "instance_qr", at);
    expect(key).toMatch(/^acao\/evo\/instance_qr\/2026-07-09\/14-30-45\.[0-9a-f-]{36}\.json$/);
  });

  it("monta chave com instanciaUuid quando informado", () => {
    const at = new Date("2026-07-09T14:30:45.123Z");
    const uuid = "7fc7a78a-141b-49b9-9816-f5d0e9e4be47";
    const key = buildAcaoProvedorLogKey("meta_cloud", "send_text", at, uuid);
    expect(key).toMatch(
      new RegExp(`^acao/meta_cloud/${uuid}/send_text/2026-07-09/14-30-45\\.[0-9a-f-]{36}\\.json$`),
    );
  });

  it("sanitiza acao inválida", () => {
    const key = buildAcaoProvedorLogKey("evo", "foo bar!", new Date("2026-01-01T00:00:00.000Z"));
    expect(key.startsWith("acao/evo/foo_bar_/2026-01-01/")).toBe(true);
  });
});

describe("redigirUrlLog", () => {
  it("redige access_token na query", () => {
    const out = redigirUrlLog(
      "https://graph.facebook.com/v25.0/123/messages?access_token=secret-token",
    );
    expect(out).toContain("access_token=%5Bredacted%5D");
    expect(out).not.toContain("secret-token");
  });
});

describe("redigirProvedorLogPayload", () => {
  it("redige tokens e trunca base64", () => {
    const base64 = "A".repeat(300);
    const out = redigirProvedorLogPayload({
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

describe("prepararProvedorAcaoLogEntry", () => {
  it("aplica formato nested e redação", () => {
    const entry = prepararProvedorAcaoLogEntry({
      provedor: "evo",
      acao: "instance_create",
      request: {
        url: "https://evo.example/instance/create",
        tipo: "POST",
        body: { token: "abc" },
      },
      response: {
        status: 200,
        body: { token: "def" },
        error: null,
        durationMs: 42,
      },
    });

    expect(entry.request.body).toEqual({ token: "[redacted]" });
    expect(entry.response.body).toEqual({ token: "[redacted]" });
    expect(entry.request.tipo).toBe("POST");
    expect(entry.acao).toBe("instance_create");
    expect(entry.provedor).toBe("evo");
    expect(entry.at).toBeTruthy();
  });

  it("preserva body de erro HTTP", () => {
    const entry = prepararProvedorAcaoLogEntry({
      provedor: "evo",
      acao: "instance_qr",
      request: {
        url: "https://evo.example/instance/qr",
        tipo: "GET",
      },
      response: {
        status: 400,
        body: { error: "no QR code available" },
        error: '{"error":"no QR code available"}',
        durationMs: 5,
      },
    });

    expect(entry.response.status).toBe(400);
    expect(entry.response.body).toEqual({ error: "no QR code available" });
    expect(entry.response.error).toContain("no QR code");
  });
});
