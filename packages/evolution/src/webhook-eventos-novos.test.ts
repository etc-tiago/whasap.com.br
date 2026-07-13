import { describe, expect, it } from "vitest";

import { carregarFixturesWebhookGo } from "./fixtures/carregar-fixtures-webhook-go";
import {
  parseGoContact,
  parseGoGroupInfo,
  parseGoJoinedGroup,
  parseGoLabelEdit,
  parseGoPicture,
  parseGoQrTimeout,
} from "./webhook-go";

describe("parsers eventos novos (fixtures + sintetico)", () => {
  const fixtures = carregarFixturesWebhookGo();

  it("1) QRTimeout => close", () => {
    expect(parseGoQrTimeout({})).toBe("close");
    const f = fixtures.find((x) => x.arquivo === "qr-timeout.json");
    expect(f).toBeTruthy();
    expect(parseGoQrTimeout((f!.payload.data ?? {}) as Record<string, unknown>)).toBe("close");
  });

  it("2) LabelEdit fixture", () => {
    const f = fixtures.find((x) => x.arquivo === "label-edit.json")!;
    const parsed = parseGoLabelEdit((f.payload.data ?? {}) as Record<string, unknown>);
    expect(parsed).toMatchObject({
      labelId: "20",
      deleted: false,
    });
    expect(parsed!.name.length).toBeGreaterThan(0);
  });

  it("3) Contact fixture", () => {
    const f = fixtures.find((x) => x.arquivo === "contact-update.json")!;
    const parsed = parseGoContact((f.payload.data ?? {}) as Record<string, unknown>);
    expect(parsed?.jid).toContain("@s.whatsapp.net");
    expect(parsed?.fullName).toBeTruthy();
    expect(parsed?.lidJid).toContain("@lid");
  });

  it("4) Picture fixture", () => {
    const f = fixtures.find((x) => x.arquivo === "picture-update.json")!;
    const parsed = parseGoPicture((f.payload.data ?? {}) as Record<string, unknown>);
    expect(parsed?.jid).toBeTruthy();
    expect(parsed?.pictureId).toBeTruthy();
    expect(parsed?.remove).toBe(false);
  });

  it("5) JoinedGroup fixture", () => {
    const f = fixtures.find((x) => x.arquivo === "joined-group.json")!;
    const parsed = parseGoJoinedGroup((f.payload.data ?? {}) as Record<string, unknown>);
    expect(parsed?.jid.endsWith("@g.us")).toBe(true);
    expect(parsed?.name).toBeTruthy();
  });

  it("6) GroupInfo fixture", () => {
    const f = fixtures.find((x) => x.arquivo === "group-info.json")!;
    const parsed = parseGoGroupInfo((f.payload.data ?? {}) as Record<string, unknown>);
    expect(parsed?.jid.endsWith("@g.us")).toBe(true);
    expect(parsed?.name).toContain("Prontuário");
  });

  it("7) LabelEdit sem LabelID retorna null", () => {
    expect(parseGoLabelEdit({ Action: { name: "x" } })).toBeNull();
  });

  it("8) JoinedGroup nao-grupo retorna null", () => {
    expect(parseGoJoinedGroup({ JID: "5511@s.whatsapp.net", Name: "x" })).toBeNull();
  });
});
