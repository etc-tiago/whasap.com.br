import { describe, expect, it } from "bun:test";

import { buildSecureInboundMediaR2Key } from "@whasap/config";

describe("storeInboundMedia HMAC keys", () => {
  it("buildSecureInboundMediaR2Key is deterministic", async () => {
    const key = await buildSecureInboundMediaR2Key("secret", "inst-uuid", "wamid.abc", "jpg");
    expect(key).toMatch(/^media\/inst-uuid\/[a-f0-9]{64}\.jpg$/);
    const again = await buildSecureInboundMediaR2Key("secret", "inst-uuid", "wamid.abc", "jpg");
    expect(again).toBe(key);
  });
});
