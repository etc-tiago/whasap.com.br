import { describe, expect, it } from "vitest";

import { separarPrefixoNomeAtendente } from "./nome-atendente-mensagem-ui";

describe("separarPrefixoNomeAtendente", () => {
  it("separa nome e corpo (legado sem asteriscos)", () => {
    expect(separarPrefixoNomeAtendente("Ana\nOlá", "Ana")).toEqual({
      nome: "Ana",
      resto: "Olá",
    });
  });

  it("separa nome com negrito WhatsApp", () => {
    expect(separarPrefixoNomeAtendente("*Ana*\nOlá", "Ana")).toEqual({
      nome: "Ana",
      resto: "Olá",
    });
  });

  it("aceita corpo só com o nome (com ou sem negrito)", () => {
    expect(separarPrefixoNomeAtendente("Ana", "Ana")).toEqual({
      nome: "Ana",
      resto: null,
    });
    expect(separarPrefixoNomeAtendente("*Ana*", "Ana")).toEqual({
      nome: "Ana",
      resto: null,
    });
  });

  it("preserva quebras no resto", () => {
    expect(separarPrefixoNomeAtendente("*Ana*\nLinha 1\nLinha 2", "Ana")).toEqual({
      nome: "Ana",
      resto: "Linha 1\nLinha 2",
    });
  });

  it("retorna null sem match", () => {
    expect(separarPrefixoNomeAtendente("Olá", "Ana")).toBeNull();
    expect(separarPrefixoNomeAtendente("Ana Clara\nOi", "Ana")).toBeNull();
    expect(separarPrefixoNomeAtendente("*Ana*\nOlá", null)).toBeNull();
  });
});
