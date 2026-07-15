import { describe, expect, it } from "vitest";

import {
  midiaExigeTextoSeparadoParaNome,
  midiaSuportaLegenda,
  montarTextoComNomeAtendente,
} from "./nome-atendente-mensagem";

describe("montarTextoComNomeAtendente", () => {
  it("monta Nome\\nconteúdo", () => {
    expect(montarTextoComNomeAtendente("Ana", "Olá")).toBe("Ana\nOlá");
  });

  it("faz trim do nome e do conteúdo", () => {
    expect(montarTextoComNomeAtendente("  Ana  ", "  Olá  ")).toBe("Ana\nOlá");
  });

  it("devolve só o nome quando conteúdo é vazio, null ou só espaços", () => {
    expect(montarTextoComNomeAtendente("Ana")).toBe("Ana");
    expect(montarTextoComNomeAtendente("Ana", null)).toBe("Ana");
    expect(montarTextoComNomeAtendente("Ana", "   ")).toBe("Ana");
  });
});

describe("midiaSuportaLegenda", () => {
  it("aceita image, video e document", () => {
    expect(midiaSuportaLegenda("image")).toBe(true);
    expect(midiaSuportaLegenda("video")).toBe(true);
    expect(midiaSuportaLegenda("document")).toBe(true);
  });

  it("rejeita audio, sticker e text", () => {
    expect(midiaSuportaLegenda("audio")).toBe(false);
    expect(midiaSuportaLegenda("sticker")).toBe(false);
    expect(midiaSuportaLegenda("text")).toBe(false);
  });
});

describe("midiaExigeTextoSeparadoParaNome", () => {
  it("exige texto separado para audio e sticker", () => {
    expect(midiaExigeTextoSeparadoParaNome("audio")).toBe(true);
    expect(midiaExigeTextoSeparadoParaNome("sticker")).toBe(true);
  });

  it("não exige para image ou text", () => {
    expect(midiaExigeTextoSeparadoParaNome("image")).toBe(false);
    expect(midiaExigeTextoSeparadoParaNome("text")).toBe(false);
  });
});
