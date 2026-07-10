import { describe, expect, it } from "vitest";

import { parseGoCreateResponse } from "./client-go";
import {
  parseGoConnectionState,
  parseGoQrResponse,
  type EvolutionGoStatusResponse,
} from "./connection-state";
import {
  buscarFixturePorCase,
  carregarFixturesRespostaGo,
} from "./fixtures/carregar-fixtures-resposta";
import {
  isEvolutionGoApiError,
  isEvolutionGoApiSuccess,
  type EvolutionGoConnectData,
  type EvolutionGoConnectResponse,
  type EvolutionGoCreateInstanceData,
  type EvolutionGoCreateResponse,
} from "./instance-types";
import type { EvolutionQrResponse } from "./types";

const fixturesCreate = carregarFixturesRespostaGo("create");
const fixturesConnect = carregarFixturesRespostaGo("connect");
const fixturesQr = carregarFixturesRespostaGo("qr");
const fixturesStatus = carregarFixturesRespostaGo("status");

describe("fixtures respostas GO", () => {
  it("carrega todos os JSONs por ação", () => {
    expect(fixturesCreate).toHaveLength(2);
    expect(fixturesConnect).toHaveLength(2);
    expect(fixturesQr).toHaveLength(3);
    expect(fixturesStatus).toHaveLength(2);
  });
});

describe("POST /instance/create", () => {
  const sucesso = fixturesCreate.filter(({ corpo }) => isEvolutionGoApiSuccess(corpo));
  const erros = fixturesCreate.filter(({ corpo }) => isEvolutionGoApiError(corpo));

  it("tem um sucesso e um erro", () => {
    expect(sucesso).toHaveLength(1);
    expect(erros).toHaveLength(1);
    expect(buscarFixturePorCase(fixturesCreate, 1)).toBeDefined();
    expect(buscarFixturePorCase(fixturesCreate, 2)).toBeDefined();
  });

  it.each(sucesso)("$caso — envelope de sucesso", ({ corpo }) => {
    expect(isEvolutionGoApiSuccess<EvolutionGoCreateInstanceData>(corpo)).toBe(true);
    if (!isEvolutionGoApiSuccess<EvolutionGoCreateInstanceData>(corpo)) return;

    expect(corpo.message).toBe("success");
    expect(corpo.data.id).toBe("d5db2cfc-f9b9-4f5d-8016-f38b8420d667");
    expect(corpo.data.name).toBe("s1a123as");
    expect(corpo.data.token).toBe("85602900-a25f-4f1f-8f8d-a970b9ea029f");
    expect(corpo.data.connected).toBe(false);
    expect(corpo.data.os_name).toBe("Linux");
    expect(corpo.data.client_name).toBe("evolution");
    expect(corpo.data.alwaysOnline).toBe(false);
    expect(corpo.data.ignoreGroups).toBe(false);
  });

  it.each(sucesso)("$caso — parseGoCreateResponse", ({ corpo }) => {
    const parsed = parseGoCreateResponse(corpo as EvolutionGoCreateResponse);
    expect(parsed).toEqual({
      instanceId: "d5db2cfc-f9b9-4f5d-8016-f38b8420d667",
      token: "85602900-a25f-4f1f-8f8d-a970b9ea029f",
      name: "s1a123as",
    });
  });

  it.each(erros)("$caso — envelope de erro", ({ corpo }) => {
    expect(isEvolutionGoApiError(corpo)).toBe(true);
    if (!isEvolutionGoApiError(corpo)) return;

    expect(corpo.error).toBe("instance already exists");
  });

  it.each(erros)("$caso — parseGoCreateResponse retorna nulls", ({ corpo }) => {
    expect(parseGoCreateResponse(corpo as EvolutionGoCreateResponse)).toEqual({
      instanceId: null,
      token: null,
      name: null,
    });
  });
});

describe("POST /instance/connect", () => {
  it.each(fixturesConnect)("$caso — envelope de sucesso", ({ corpo }) => {
    expect(isEvolutionGoApiSuccess<EvolutionGoConnectData>(corpo)).toBe(true);
    if (!isEvolutionGoApiSuccess<EvolutionGoConnectData>(corpo)) return;

    expect(corpo.message).toBe("success");
    expect(typeof corpo.data.eventString).toBe("string");
    expect(typeof corpo.data.jid).toBe("string");
    expect(typeof corpo.data.webhookUrl).toBe("string");
  });

  it("case-1 — só MESSAGE e webhook vazio", () => {
    const fixture = buscarFixturePorCase(fixturesConnect, 1);
    expect(fixture).toBeDefined();
    if (!fixture || !isEvolutionGoApiSuccess<EvolutionGoConnectData>(fixture.corpo)) return;

    const resposta = fixture.corpo as EvolutionGoConnectResponse;
    expect(resposta.data.eventString).toBe("MESSAGE");
    expect(resposta.data.jid).toBe("");
    expect(resposta.data.webhookUrl).toBe("");
  });

  it("case-2 — webhook e todos os eventos", () => {
    const fixture = buscarFixturePorCase(fixturesConnect, 2);
    expect(fixture).toBeDefined();
    if (!fixture || !isEvolutionGoApiSuccess<EvolutionGoConnectData>(fixture.corpo)) return;

    const resposta = fixture.corpo as EvolutionGoConnectResponse;
    expect(resposta.data.webhookUrl).toBe("https://webhook.whasap.com.br/evo");
    expect(resposta.data.eventString).toContain("MESSAGE");
    expect(resposta.data.eventString).toContain("QRCODE");
    expect(resposta.data.eventString).toContain("CONNECTION");
    expect(resposta.data.jid).toBe("");
  });
});

describe("GET /instance/qr", () => {
  const sucesso = fixturesQr.filter(({ corpo }) => isEvolutionGoApiSuccess(corpo));
  const erros = fixturesQr.filter(({ corpo }) => isEvolutionGoApiError(corpo));

  it("tem um sucesso e dois erros", () => {
    expect(sucesso).toHaveLength(1);
    expect(erros).toHaveLength(2);
    expect(buscarFixturePorCase(fixturesQr, 1)).toBeDefined();
    expect(buscarFixturePorCase(fixturesQr, 2)).toBeDefined();
    expect(buscarFixturePorCase(fixturesQr, 3)).toBeDefined();
  });

  it.each(sucesso)("$caso — envelope de sucesso", ({ corpo }) => {
    expect(isEvolutionGoApiSuccess(corpo)).toBe(true);
    if (!isEvolutionGoApiSuccess<{ qrcode?: string; code?: string }>(corpo)) return;

    expect(corpo.message).toBe("success");
    expect(corpo.data.qrcode).toMatch(/^data:image\/png;base64,/);
    expect(corpo.data.code).toMatch(/^https:\/\/wa\.me\/settings\/linked_devices#/);
  });

  it.each(sucesso)("$caso — parseGoQrResponse", ({ corpo }) => {
    const parsed = parseGoQrResponse(corpo as EvolutionQrResponse);
    expect(parsed.base64).toMatch(/^data:image\/png;base64,/);
    expect(parsed.pairingCode).toMatch(/^https:\/\/wa\.me\/settings\/linked_devices#/);
  });

  it.each(erros)("$caso — envelope de erro", ({ corpo }) => {
    expect(isEvolutionGoApiError(corpo)).toBe(true);
  });

  it("case-2 — QR indisponível", () => {
    const fixture = buscarFixturePorCase(fixturesQr, 2);
    expect(fixture).toBeDefined();
    if (!fixture || !isEvolutionGoApiError(fixture.corpo)) return;

    expect(fixture.corpo.error).toBe("no QR code available. Please wait a moment and try again");
    expect(parseGoQrResponse(fixture.corpo as EvolutionQrResponse)).toEqual({
      base64: null,
      pairingCode: null,
    });
  });

  it("case-3 — sessão já logada", () => {
    const fixture = buscarFixturePorCase(fixturesQr, 3);
    expect(fixture).toBeDefined();
    if (!fixture || !isEvolutionGoApiError(fixture.corpo)) return;

    expect(fixture.corpo.error).toBe("session already logged in");
    expect(parseGoQrResponse(fixture.corpo as EvolutionQrResponse)).toEqual({
      base64: null,
      pairingCode: null,
    });
  });
});

describe("GET /instance/status", () => {
  it.each(fixturesStatus)("$caso — envelope de sucesso", ({ corpo }) => {
    expect(isEvolutionGoApiSuccess(corpo)).toBe(true);
    if (
      !isEvolutionGoApiSuccess<{ Connected?: boolean; LoggedIn?: boolean; Name?: string }>(corpo)
    ) {
      return;
    }

    expect(corpo.message).toBe("success");
    expect(typeof corpo.data.Connected).toBe("boolean");
    expect(typeof corpo.data.LoggedIn).toBe("boolean");
    expect(typeof corpo.data.Name).toBe("string");
  });

  it("case-1 — desconectado", () => {
    const fixture = buscarFixturePorCase(fixturesStatus, 1);
    expect(fixture).toBeDefined();
    if (!fixture) return;

    const resposta = fixture.corpo as EvolutionGoStatusResponse;
    expect(parseGoConnectionState(resposta)).toBe("close");
    expect(resposta.data?.Connected).toBe(false);
    expect(resposta.data?.LoggedIn).toBe(false);
    expect(resposta.data?.Name).toBe("");
  });

  it("case-2 — conectado com Name", () => {
    const fixture = buscarFixturePorCase(fixturesStatus, 2);
    expect(fixture).toBeDefined();
    if (!fixture) return;

    const resposta = fixture.corpo as EvolutionGoStatusResponse;
    expect(parseGoConnectionState(resposta)).toBe("open");
    expect(resposta.data?.Connected).toBe(true);
    expect(resposta.data?.LoggedIn).toBe(true);
    expect(resposta.data?.Name).toBe("Sistema ClínicaWork");
  });
});
