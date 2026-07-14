import { describe, expect, it } from "vitest";

import { eSessaoNaoAutorizada } from "./orpc-error";

describe("eSessaoNaoAutorizada", () => {
  it("detecta code UNAUTHORIZED e status 401", () => {
    expect(eSessaoNaoAutorizada({ code: "UNAUTHORIZED" })).toBe(true);
    expect(eSessaoNaoAutorizada({ status: 401 })).toBe(true);
  });

  it("ignora outros erros", () => {
    expect(eSessaoNaoAutorizada(null)).toBe(false);
    expect(eSessaoNaoAutorizada({ code: "FORBIDDEN" })).toBe(false);
    expect(eSessaoNaoAutorizada(new Error("boom"))).toBe(false);
  });
});
