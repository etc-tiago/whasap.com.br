import { describe, expect, it } from "vitest";

import { buildSecureInboundMediaR2Key, mimeToExtension } from "./cdn";

describe("buildSecureInboundMediaR2Key", () => {
  it("produces deterministic HMAC path", async () => {
    const key = await buildSecureInboundMediaR2Key("test-secret", "uuid-1", "msg-abc", "jpg");
    expect(key).toMatch(/^media\/uuid-1\/[a-f0-9]{64}\.jpg$/);
    const key2 = await buildSecureInboundMediaR2Key("test-secret", "uuid-1", "msg-abc", "jpg");
    expect(key2).toBe(key);
  });

  it("differs when seed changes", async () => {
    const a = await buildSecureInboundMediaR2Key("test-secret", "uuid-1", "msg-a", "jpg");
    const b = await buildSecureInboundMediaR2Key("test-secret", "uuid-1", "msg-b", "jpg");
    expect(a).not.toBe(b);
  });
});

describe("mimeToExtension", () => {
  it("maps image/jpeg", () => {
    expect(mimeToExtension("image/jpeg")).toBe("jpg");
  });

  it("uses filename extension when provided", () => {
    expect(mimeToExtension("application/octet-stream", "report.pdf")).toBe("pdf");
  });
});
