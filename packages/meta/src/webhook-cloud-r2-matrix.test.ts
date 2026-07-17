/**
 * Soft: webhooks Meta Cloud reais em `packages/r2-sync/json/webhook/cloud`.
 */
import { describe, expect, it } from "vitest";

import {
  carregarWebhooksMetaR2,
  corpusWebhookMetaR2Disponivel,
} from "./fixtures/carregar-webhooks-meta-r2";
import { parseMetaMessage, parseMetaStatus, parseMetaWebhook } from "./webhook-cloud";

const ok = corpusWebhookMetaR2Disponivel();

describe.skipIf(!ok)("matriz R2 meta_cloud (corpus local)", () => {
  const fixtures = ok ? carregarWebhooksMetaR2() : [];

  it("1) carrega pelo menos um webhook cloud", () => {
    expect(fixtures.length).toBeGreaterThanOrEqual(1);
  });

  it("2) parseMetaWebhook extrai changes com phoneNumberId", () => {
    let changesOk = 0;
    for (const fixture of fixtures) {
      const changes = parseMetaWebhook(fixture.payload);
      expect(changes.length, fixture.arquivo).toBeGreaterThan(0);
      for (const change of changes) {
        expect(change.phoneNumberId, fixture.arquivo).toBeTruthy();
        changesOk += 1;
      }
    }
    expect(changesOk).toBeGreaterThan(0);
  });

  it("3) contacts.user_id e from_user_id quando presentes", () => {
    let comUserId = 0;
    let comFromUserId = 0;
    for (const fixture of fixtures) {
      const changes = parseMetaWebhook(fixture.payload);
      for (const change of changes) {
        for (const c of change.contacts) {
          if (c.userId) comUserId += 1;
        }
        for (const msg of change.messages) {
          const parsed = parseMetaMessage(msg);
          if (!parsed) continue;
          if (typeof parsed.metadados.fromUserId === "string") comFromUserId += 1;
        }
      }
    }
    // Corpus 17/07: unsupported inbound com user_id em contact + from_user_id.
    expect(comUserId + comFromUserId).toBeGreaterThan(0);
  });

  it("4) mensagens unsupported parseiam sem quebrar", () => {
    let unsupported = 0;
    for (const fixture of fixtures) {
      for (const change of parseMetaWebhook(fixture.payload)) {
        for (const msg of change.messages) {
          if (String(msg.type) !== "unsupported") continue;
          const parsed = parseMetaMessage(msg);
          expect(parsed, fixture.arquivo).not.toBeNull();
          expect(parsed!.type).toBe("unsupported");
          expect(parsed!.metadados.errors).toBeTruthy();
          unsupported += 1;
        }
      }
    }
    if (unsupported === 0) return;
    expect(unsupported).toBeGreaterThan(0);
  });

  it("5) statuses com pricing PMP quando presentes", () => {
    let comPricing = 0;
    for (const fixture of fixtures) {
      for (const change of parseMetaWebhook(fixture.payload)) {
        for (const status of change.statuses) {
          const parsed = parseMetaStatus(status);
          if (!parsed) continue;
          expect(parsed.externalId).toContain("wamid.");
          if (parsed.pricing?.pricingModel) {
            expect(parsed.pricing.pricingModel).toBe("PMP");
            comPricing += 1;
          }
        }
      }
    }
    // Corpus pode ter só messages sem status — não falha se ausente.
    if (comPricing === 0) return;
    expect(comPricing).toBeGreaterThan(0);
  });
});
