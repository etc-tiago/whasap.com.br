/**
 * Soft: edit_encrypted + revoke reais no corpus R2 (`packages/r2-sync/json/webhook/evo`).
 */
import { describe, expect, it } from "vitest";

import { carregarWebhooksR2, corpusWebhookR2Disponivel } from "./fixtures/carregar-webhooks-r2";
import { parseGoMessageEvent } from "./webhook-go";

const ok = corpusWebhookR2Disponivel();

function mensagemTemSecretEdit(data: Record<string, unknown>): boolean {
  const message = data.Message as Record<string, unknown> | undefined;
  const secret = message?.secretEncryptedMessage as Record<string, unknown> | undefined;
  if (!secret) return false;
  const encType = secret.secretEncType;
  return (
    encType === 2 || encType === "MESSAGE_EDIT" || encType === "SecretEncryptedMessage_MESSAGE_EDIT"
  );
}

function mensagemTemRevoke(data: Record<string, unknown>): boolean {
  const message = data.Message as Record<string, unknown> | undefined;
  const protocol = message?.protocolMessage as { type?: number | string } | undefined;
  if (!protocol) return false;
  return protocol.type === 0 || protocol.type === "REVOKE";
}

describe.skipIf(!ok)("R2 Message edit_encrypted + revoke", () => {
  const messages = ok ? carregarWebhooksR2({ evento: "Message" }) : [];

  it("1) parseia secretEncryptedMessage MESSAGE_EDIT como edit_encrypted", () => {
    const edits = messages.filter((f) => mensagemTemSecretEdit(f.data));
    if (edits.length === 0) return;

    expect(edits.length).toBeGreaterThanOrEqual(1);
    for (const fixture of edits) {
      const parsed = parseGoMessageEvent(fixture.data);
      expect(parsed, fixture.arquivo).not.toBeNull();
      expect(parsed!.type, fixture.arquivo).toBe("edit_encrypted");
      expect(parsed!.editTargetId, fixture.arquivo).toBeTruthy();
      expect(parsed!.body, fixture.arquivo).toBe("");
      expect(parsed!.editEncrypted?.editTargetId, fixture.arquivo).toBe(parsed!.editTargetId);
      expect(parsed!.editEncrypted!.encIv.length, fixture.arquivo).toBeGreaterThan(0);
      expect(parsed!.editEncrypted!.encPayload.length, fixture.arquivo).toBeGreaterThan(0);
      expect(String((fixture.data.Info as Record<string, unknown>).Edit ?? "")).toBe("1");
    }
  });

  it("2) parseia protocolMessage type 0 como revoke", () => {
    const revokes = messages.filter((f) => mensagemTemRevoke(f.data));
    if (revokes.length === 0) return;

    expect(revokes.length).toBeGreaterThanOrEqual(1);
    for (const fixture of revokes) {
      const parsed = parseGoMessageEvent(fixture.data);
      expect(parsed, fixture.arquivo).not.toBeNull();
      expect(parsed!.type, fixture.arquivo).toBe("revoke");
      expect(parsed!.body.length, fixture.arquivo).toBeGreaterThan(0);
      expect(parsed!.messageId, fixture.arquivo).toBeTruthy();
    }
  });
});
