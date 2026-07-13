import { describe, expect, it } from "vitest";

import {
  cnpjValido,
  normalizarTelefoneWhatsappBr,
  telefoneWhatsappBrValido,
} from "./documento-fiscal";

describe("cnpjValido", () => {
  it("aceita CNPJ válido com máscara", () => {
    expect(cnpjValido("11.222.333/0001-81")).toBe(true);
  });

  it("aceita CNPJ válido só dígitos", () => {
    expect(cnpjValido("11222333000181")).toBe(true);
  });

  it("rejeita dígitos repetidos e tamanho inválido", () => {
    expect(cnpjValido("00.000.000/0000-00")).toBe(false);
    expect(cnpjValido("11222333000180")).toBe(false);
    expect(cnpjValido("123")).toBe(false);
  });
});

describe("telefoneWhatsappBrValido", () => {
  it("aceita local e com 55", () => {
    expect(telefoneWhatsappBrValido("(11) 98888-7777")).toBe(true);
    expect(telefoneWhatsappBrValido("5511988887777")).toBe(true);
    expect(telefoneWhatsappBrValido("1133334444")).toBe(true);
  });

  it("rejeita curto demais", () => {
    expect(telefoneWhatsappBrValido("119888")).toBe(false);
  });

  it("normaliza com 55", () => {
    expect(normalizarTelefoneWhatsappBr("11988887777")).toBe("5511988887777");
    expect(normalizarTelefoneWhatsappBr("5511988887777")).toBe("5511988887777");
  });
});
