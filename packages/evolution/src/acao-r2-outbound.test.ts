/**
 * Soft: ações outbound message_delete / send_* no corpus R2 (`acao/evo`).
 * Após exercitar exclusão/envio no painel e `bun run r2:sync`, estes asserts passam.
 */
import { describe, expect, it } from "vitest";

import { carregarAcaoR2, corpusAcaoR2Disponivel } from "./fixtures/carregar-acao-r2";

const temDelete = corpusAcaoR2Disponivel("message_delete");
const temSendText = corpusAcaoR2Disponivel("send_text");
const temAlgumSend =
  temSendText ||
  corpusAcaoR2Disponivel("send_image") ||
  corpusAcaoR2Disponivel("send_audio") ||
  corpusAcaoR2Disponivel("send_link");

describe.skipIf(!temDelete)("acao R2 message_delete", () => {
  const fixtures = temDelete ? carregarAcaoR2({ acao: "message_delete" }) : [];

  it("1) envelope canônico message_delete", () => {
    expect(fixtures.length).toBeGreaterThanOrEqual(1);
    for (const f of fixtures) {
      const e = f.envelope;
      expect(e.provedor, f.arquivo).toBe("evo");
      expect(e.acao, f.arquivo).toBe("message_delete");
      expect(e.request.tipo, f.arquivo).toBe("POST");
      expect(e.request.url, f.arquivo).toMatch(/\/message\/delete$/);
      expect(e.response, f.arquivo).toBeTruthy();
      expect(e.meta?.instanciaUuid, f.arquivo).toBeTruthy();
      const body = e.request.body as Record<string, unknown> | undefined;
      expect(body?.chat ?? body?.messageId, f.arquivo).toBeTruthy();
    }
  });
});

describe.skipIf(!temAlgumSend)("acao R2 send_*", () => {
  it("1) envelope canônico send_text quando presente", () => {
    if (!temSendText) return;
    const fixtures = carregarAcaoR2({ acao: "send_text" });
    expect(fixtures.length).toBeGreaterThanOrEqual(1);
    for (const f of fixtures) {
      const e = f.envelope;
      expect(e.provedor, f.arquivo).toBe("evo");
      expect(e.acao, f.arquivo).toBe("send_text");
      expect(e.request.tipo, f.arquivo).toBe("POST");
      expect(e.request.url, f.arquivo).toMatch(/\/send\/text$/);
      expect(e.meta?.instanciaUuid, f.arquivo).toBeTruthy();
    }
  });

  it("2) demais send_* têm request.url e response", () => {
    for (const acao of ["send_image", "send_audio", "send_link"] as const) {
      if (!corpusAcaoR2Disponivel(acao)) continue;
      const fixtures = carregarAcaoR2({ acao });
      expect(fixtures.length).toBeGreaterThanOrEqual(1);
      for (const f of fixtures) {
        expect(f.envelope.acao, f.arquivo).toBe(acao);
        expect(f.envelope.request.url, f.arquivo).toBeTruthy();
        expect(f.envelope.response, f.arquivo).toBeTruthy();
      }
    }
  });
});
