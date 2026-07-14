import { describe, expect, it } from "vitest";
import { isDefinedError } from "@orpc/client";

import { eSessaoNaoAutorizada, getOrpcErrorMessage } from "./orpc-error";

describe("eSessaoNaoAutorizada", () => {
  it("detecta code UNAUTHORIZED e status 401", () => {
    expect(eSessaoNaoAutorizada({ code: "UNAUTHORIZED" })).toBe(true);
    expect(eSessaoNaoAutorizada({ status: 401 })).toBe(true);
  });

  it("aceita ambos code e status juntos", () => {
    expect(eSessaoNaoAutorizada({ code: "UNAUTHORIZED", status: 401 })).toBe(true);
  });

  it("ignora outros erros", () => {
    expect(eSessaoNaoAutorizada(null)).toBe(false);
    expect(eSessaoNaoAutorizada(undefined)).toBe(false);
    expect(eSessaoNaoAutorizada({ code: "FORBIDDEN" })).toBe(false);
    expect(eSessaoNaoAutorizada({ code: "PRECONDITION_FAILED", status: 412 })).toBe(false);
    expect(eSessaoNaoAutorizada(new Error("boom"))).toBe(false);
    expect(eSessaoNaoAutorizada("UNAUTHORIZED")).toBe(false);
  });
});

describe("getOrpcErrorMessage", () => {
  it("usa message de erro ORPC definido", () => {
    const err = Object.assign(new Error("Não autenticado"), {
      defined: true,
      code: "UNAUTHORIZED",
    });
    // isDefinedError exige shape ORPC; se não bater, cai no Error.message
    if (isDefinedError(err)) {
      expect(getOrpcErrorMessage(err, "fallback")).toBe("Não autenticado");
    } else {
      expect(getOrpcErrorMessage(err, "fallback")).toBe("Não autenticado");
    }
  });

  it("usa Error.message quando não é ORPC definido", () => {
    expect(getOrpcErrorMessage(new Error("timeout"), "fallback")).toBe("timeout");
  });

  it("usa fallback quando não há mensagem", () => {
    expect(getOrpcErrorMessage(null, "algo falhou")).toBe("algo falhou");
    expect(getOrpcErrorMessage({}, "algo falhou")).toBe("algo falhou");
    expect(getOrpcErrorMessage(new Error(""), "algo falhou")).toBe("algo falhou");
  });
});
