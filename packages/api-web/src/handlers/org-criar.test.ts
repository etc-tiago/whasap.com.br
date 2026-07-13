import { describe, expect, it } from "vitest";
import {
  cnpjValido,
  mvpDefaults,
  normalizarTelefoneWhatsappBr,
  somenteDigitos,
  telefoneWhatsappBrValido,
} from "@whasap/config";

/**
 * Espelha as regras de `organizacao.criar` (validação de entrada)
 * sem dependência de DB — contrato + handler devem alinhar a isto.
 */
function validarEntradaCriarOrg(input: {
  nome: string;
  documento: string;
  tipoDocumento: "cnpj";
  razaoSocial: string;
  telefoneWhatsapp: string;
  aceiteAdesao: true;
}) {
  if (input.nome.trim().length < 2) return { ok: false as const, erro: "nome" };
  if (input.tipoDocumento !== "cnpj") return { ok: false as const, erro: "tipoDocumento" };
  if (!cnpjValido(input.documento)) return { ok: false as const, erro: "documento" };
  if (input.razaoSocial.trim().length < 2) return { ok: false as const, erro: "razaoSocial" };
  if (!telefoneWhatsappBrValido(input.telefoneWhatsapp)) {
    return { ok: false as const, erro: "telefoneWhatsapp" };
  }
  if (input.aceiteAdesao !== true) return { ok: false as const, erro: "aceiteAdesao" };
  return {
    ok: true as const,
    persistido: {
      documentoFiscal: somenteDigitos(input.documento),
      telefoneWhatsapp: normalizarTelefoneWhatsappBr(input.telefoneWhatsapp),
      aceiteAdesaoVersao: mvpDefaults.legal.adesaoVersao,
    },
  };
}

describe("organizacao.criar — validação de cadastro fiscal", () => {
  const base = {
    nome: "Acme",
    documento: "11.222.333/0001-81",
    tipoDocumento: "cnpj" as const,
    razaoSocial: "Acme Ltda",
    telefoneWhatsapp: "(11) 98888-7777",
    aceiteAdesao: true as const,
  };

  it("aceita payload completo e normaliza CNPJ/WhatsApp + versão do termo", () => {
    const r = validarEntradaCriarOrg(base);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.persistido.documentoFiscal).toBe("11222333000181");
    expect(r.persistido.telefoneWhatsapp).toBe("5511988887777");
    expect(r.persistido.aceiteAdesaoVersao).toBe("2026-07");
  });

  it("rejeita CNPJ inválido", () => {
    expect(validarEntradaCriarOrg({ ...base, documento: "11222333000180" }).ok).toBe(false);
  });

  it("rejeita WhatsApp inválido", () => {
    expect(validarEntradaCriarOrg({ ...base, telefoneWhatsapp: "1199" }).ok).toBe(false);
  });
});
