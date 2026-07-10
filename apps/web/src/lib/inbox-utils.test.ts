import { describe, expect, it } from "vitest";

import { formatarPreviewMensagem, tempoRestanteJanela } from "./inbox-utils";

describe("formatarPreviewMensagem", () => {
  it("mapeia tipos especiais", () => {
    expect(formatarPreviewMensagem("[sticker]", "sticker")).toBe("Figurinha");
    expect(formatarPreviewMensagem("👍", "reaction")).toBe("Reagiu com 👍");
    expect(formatarPreviewMensagem("Qual horário?", "poll")).toBe("Enquete: Qual horário?");
    expect(formatarPreviewMensagem("Maria", "contacts")).toBe("Contato: Maria");
    expect(formatarPreviewMensagem("Consulta", "event")).toBe("Evento: Consulta");
    expect(formatarPreviewMensagem("Confirmar", "interactive")).toBe("Confirmar");
    expect(formatarPreviewMensagem("[interativo]", "interactive")).toBe("Mensagem interativa");
  });

  it("usa fallback de corpo placeholder", () => {
    expect(formatarPreviewMensagem("[enquete]")).toBe("Enquete");
    expect(formatarPreviewMensagem("[reação]")).toBe("Reação");
  });

  it("mantém texto comum", () => {
    expect(formatarPreviewMensagem("Olá!", "text")).toBe("Olá!");
  });
});

describe("tempoRestanteJanela", () => {
  it("retorna null quando expirado", () => {
    expect(tempoRestanteJanela("2020-01-01T00:00:00.000Z")).toBeNull();
  });

  it("calcula horas e minutos restantes", () => {
    const agora = new Date("2026-07-10T12:00:00.000Z");
    const expira = new Date("2026-07-10T14:30:00.000Z").toISOString();
    expect(tempoRestanteJanela(expira, agora)).toEqual({ horas: 2, minutos: 30 });
  });
});
