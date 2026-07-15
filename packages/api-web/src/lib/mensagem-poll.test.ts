import { describe, expect, it } from "vitest";

import { mapearPollMensagem, pollDeCorpoFlat } from "./mensagem-poll";

describe("pollDeCorpoFlat", () => {
  it("parseia nome e opcoes", () => {
    expect(pollDeCorpoFlat("Aba: 1, 2")).toEqual({ name: "Aba", options: ["1", "2"] });
  });

  it("nome sem opcoes", () => {
    expect(pollDeCorpoFlat("So nome")).toEqual({ name: "So nome", options: [] });
  });

  it("placeholder", () => {
    expect(pollDeCorpoFlat("[enquete]")).toEqual({ name: "[enquete]", options: [] });
    expect(pollDeCorpoFlat(null)).toEqual({ name: "[enquete]", options: [] });
  });
});

describe("mapearPollMensagem", () => {
  it("retorna null para tipo nao poll", () => {
    expect(mapearPollMensagem("text", "oi", null)).toBeNull();
  });

  it("prioriza metadados.poll", () => {
    expect(
      mapearPollMensagem("poll", "Aba: 1, 2", {
        poll: { name: "Aba", options: ["1", "2"], selectableOptionsCount: 1 },
      }),
    ).toEqual({ name: "Aba", options: ["1", "2"], selectableOptionsCount: 1 });
  });

  it("fallback do corpo flat legado", () => {
    expect(mapearPollMensagem("poll", "Aba: 1, 2", { origemGo: true })).toEqual({
      name: "Aba",
      options: ["1", "2"],
    });
  });
});
