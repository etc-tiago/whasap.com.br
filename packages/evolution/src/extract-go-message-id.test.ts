import { describe, expect, it } from "vitest";

import { extractGoMessageId } from "./client-go";

describe("extractGoMessageId", () => {
  it("extrai data.Info.ID do shape Evolution GO", () => {
    expect(
      extractGoMessageId({
        message: "success",
        data: {
          Info: {
            ID: "3B7093F83FAA42AAFD43",
            IsFromMe: true,
          } as { ID?: string },
          Message: { conversation: "oi" },
        },
      }),
    ).toBe("3B7093F83FAA42AAFD43");
  });

  it("extrai Info.ID flat", () => {
    expect(extractGoMessageId({ Info: { ID: "ABC123" } })).toBe("ABC123");
  });

  it("aceita legado Baileys key.id", () => {
    expect(extractGoMessageId({ key: { id: "BAILEYS-1" } })).toBe("BAILEYS-1");
  });

  it("aceita id / messageId legados", () => {
    expect(extractGoMessageId({ id: "ID-1" })).toBe("ID-1");
    expect(extractGoMessageId({ messageId: "MID-1" })).toBe("MID-1");
  });

  it("prioriza data.Info.ID sobre key.id", () => {
    expect(
      extractGoMessageId({
        data: { Info: { ID: "GO-ID" } },
        key: { id: "LEGACY" },
      }),
    ).toBe("GO-ID");
  });

  it("retorna null quando ausente ou vazio", () => {
    expect(extractGoMessageId({})).toBeNull();
    expect(extractGoMessageId({ data: { Info: { ID: "  " } } })).toBeNull();
    expect(extractGoMessageId({ message: "success", data: {} })).toBeNull();
  });
});
