import { describe, expect, it } from "vitest";

import { parseGoCreateResponse } from "./client-go";

describe("parseGoCreateResponse", () => {
  it("lê data.id do JSON real de create", () => {
    expect(
      parseGoCreateResponse({
        data: {
          id: "d5db2cfc-f9b9-4f5d-8016-f38b8420d667",
          name: "s1a123as",
          token: "85602900-a25f-4f1f-8f8d-a970b9ea029f",
          connected: false,
        },
        message: "success",
      }),
    ).toEqual({
      instanceId: "d5db2cfc-f9b9-4f5d-8016-f38b8420d667",
      token: "85602900-a25f-4f1f-8f8d-a970b9ea029f",
      name: "s1a123as",
    });
  });

  it("mantém fallback para instanceId legado", () => {
    expect(
      parseGoCreateResponse({
        data: {
          instanceId: "legado-id",
          name: "inst",
          token: "tok",
          connected: false,
          id: "novo-id",
        },
      }),
    ).toEqual({
      instanceId: "novo-id",
      token: "tok",
      name: "inst",
    });
  });

  it("lê campos no root como fallback", () => {
    expect(
      parseGoCreateResponse({
        instanceId: "root-id",
        token: "root-tok",
        name: "root-name",
      }),
    ).toEqual({
      instanceId: "root-id",
      token: "root-tok",
      name: "root-name",
    });
  });
});
