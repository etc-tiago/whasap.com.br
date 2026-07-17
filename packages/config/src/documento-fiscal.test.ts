import { describe, expect, it } from "vitest";

import {
  cnpjValido,
  idExternoWhatsappBr,
  normalizarTelefoneWhatsappBr,
  telefoneWhatsappBrValido,
  variantesIdExternoWhatsappBr,
  variantesTelefoneWhatsappBr,
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
});

describe("normalizarTelefoneWhatsappBr", () => {
  it("normaliza com 55 e 9º dígito em celular", () => {
    expect(normalizarTelefoneWhatsappBr("11988887777")).toBe("5511988887777");
    expect(normalizarTelefoneWhatsappBr("5511988887777")).toBe("5511988887777");
  });

  it("unifica celular com e sem 9º dígito (12 ↔ 13)", () => {
    // sem 9: 55+DDD+8 · com 9: 55+DDD+9+8
    expect(normalizarTelefoneWhatsappBr("554183008444")).toBe("5541983008444");
    expect(normalizarTelefoneWhatsappBr("5541983008444")).toBe("5541983008444");
    expect(normalizarTelefoneWhatsappBr("4183008444")).toBe("5541983008444");
    expect(normalizarTelefoneWhatsappBr("41983008444")).toBe("5541983008444");
    expect(normalizarTelefoneWhatsappBr("554188694785")).toBe("5541988694785");
    expect(normalizarTelefoneWhatsappBr("5541988694785")).toBe("5541988694785");
  });

  it("não insere 9 em fixo", () => {
    expect(normalizarTelefoneWhatsappBr("554133334444")).toBe("554133334444");
    expect(normalizarTelefoneWhatsappBr("4133334444")).toBe("554133334444");
  });
});

describe("variantesTelefoneWhatsappBr", () => {
  it("inclui forma com e sem 9", () => {
    expect(variantesTelefoneWhatsappBr("5541983008444").toSorted()).toEqual([
      "554183008444",
      "5541983008444",
    ]);
    expect(variantesTelefoneWhatsappBr("554183008444").toSorted()).toEqual([
      "554183008444",
      "5541983008444",
    ]);
  });

  it("fixo só tem a forma canônica", () => {
    expect(variantesTelefoneWhatsappBr("554133334444")).toEqual(["554133334444"]);
  });
});

describe("variantesIdExternoWhatsappBr", () => {
  it("gera JIDs equivalentes e preserva LID/grupo", () => {
    expect(variantesIdExternoWhatsappBr("554183008444@s.whatsapp.net").toSorted()).toEqual([
      "554183008444@s.whatsapp.net",
      "5541983008444@s.whatsapp.net",
    ]);
    expect(variantesIdExternoWhatsappBr("12345@lid")).toEqual(["12345@lid"]);
    expect(variantesIdExternoWhatsappBr("120363@g.us")).toEqual(["120363@g.us"]);
  });

  it("idExternoWhatsappBr usa forma canônica", () => {
    expect(idExternoWhatsappBr("554183008444")).toBe("5541983008444@s.whatsapp.net");
  });
});
