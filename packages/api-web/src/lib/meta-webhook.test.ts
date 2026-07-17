import { describe, expect, it } from "vitest";

import { obterConfigWebhookCloud, urlWebhookCloud } from "./meta-webhook";

describe("meta-webhook", () => {
  it("monta callback URL com path /cloud", () => {
    expect(urlWebhookCloud({ WEBHOOK_URL: "https://webhook.example" })).toBe(
      "https://webhook.example/cloud",
    );
  });

  it("usa o UUID da conexão como verify token", () => {
    const uuid = "9e9aad17-4093-4fbf-b0eb-4bdb6d6066bd";
    expect(obterConfigWebhookCloud({ WEBHOOK_URL: "https://webhook.whasap.com.br" }, uuid)).toEqual(
      {
        callbackUrl: "https://webhook.whasap.com.br/cloud",
        verifyToken: uuid,
        campos: ["messages", "message_template_status_update"],
      },
    );
  });
});
