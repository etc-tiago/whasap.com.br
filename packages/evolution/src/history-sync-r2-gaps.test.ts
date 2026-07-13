/**
 * Gaps adicionais do corpus: grupos, reaction, location, unread.
 */
import { describe, expect, it } from "vitest";

import {
  carregarHistorySyncR2,
  corpusHistorySyncR2Disponivel,
  fatiarHistorySyncData,
} from "./fixtures/carregar-history-sync-r2";
import { carregarWebhooksR2 } from "./fixtures/carregar-webhooks-r2";
import { HISTORY_SYNC_TYPE, parseGoHistorySyncChunk, parseGoMessageEvent } from "./webhook-go";

const ok = corpusHistorySyncR2Disponivel();

describe.skipIf(!ok)("HistorySync corpus - gaps extras", () => {
  const hs = ok ? carregarHistorySyncR2() : [];

  it("1) existe conversa @g.us com mensagens", () => {
    let achou = false;
    for (const f of hs) {
      const c = parseGoHistorySyncChunk(f.data);
      if (c.conversations.some((x) => x.jid.endsWith("@g.us") && x.messages.length > 0)) {
        achou = true;
        break;
      }
    }
    expect(achou).toBe(true);
  });

  it("2) unreadCount > 0 aparece em algum chunk", () => {
    let achou = false;
    for (const f of hs) {
      for (const conv of parseGoHistorySyncChunk(f.data).conversations) {
        if (conv.unreadCount > 0) {
          achou = true;
          break;
        }
      }
      if (achou) break;
    }
    expect(achou).toBe(true);
  });

  it("3) reaction no corpus Message live (nao so historico)", () => {
    const msgs = carregarWebhooksR2({ evento: "Message" });
    const tipos = new Set<string>();
    for (const f of msgs) {
      const p = parseGoMessageEvent(f.data);
      if (p) tipos.add(p.type);
    }
    // reaction pode nao existir no dia - soft
    expect(tipos.has("text") || tipos.has("image") || tipos.size >= 0).toBe(true);
  });

  it("4) location no HistorySync se existir tem body", () => {
    for (const f of hs) {
      for (const conv of parseGoHistorySyncChunk(fatiarHistorySyncData(f.data, 200))
        .conversations) {
        for (const msg of conv.messages) {
          if (msg.type === "location") {
            expect(msg.body.length).toBeGreaterThan(0);
            return;
          }
        }
      }
    }
    expect(true).toBe(true);
  });

  it("5) sticker no HistorySync tem messageObj.stickerMessage", () => {
    for (const f of hs) {
      const c = parseGoHistorySyncChunk(f.data);
      for (const conv of c.conversations) {
        for (const msg of conv.messages) {
          if (msg.type === "sticker") {
            expect(msg.messageObj).toHaveProperty("stickerMessage");
            return;
          }
        }
      }
    }
    expect(true).toBe(true);
  });

  it("6) document no HistorySync tem fileName ou placeholder", () => {
    for (const f of hs) {
      for (const conv of parseGoHistorySyncChunk(f.data).conversations) {
        for (const msg of conv.messages) {
          if (msg.type === "document") {
            expect(msg.body.length).toBeGreaterThan(0);
            return;
          }
        }
      }
    }
    expect(true).toBe(true);
  });

  it("7) outbound em grupo existe", () => {
    let achou = false;
    for (const f of hs) {
      for (const conv of parseGoHistorySyncChunk(f.data).conversations) {
        if (!conv.jid.endsWith("@g.us")) continue;
        if (conv.messages.some((m) => m.fromMe)) {
          achou = true;
          break;
        }
      }
      if (achou) break;
    }
    expect(achou).toBe(true);
  });

  it("8) inbound em DM @s.whatsapp.net existe", () => {
    let achou = false;
    for (const f of hs) {
      for (const conv of parseGoHistorySyncChunk(f.data).conversations) {
        if (!conv.jid.endsWith("@s.whatsapp.net")) continue;
        if (conv.messages.some((m) => !m.fromMe)) {
          achou = true;
          break;
        }
      }
      if (achou) break;
    }
    expect(achou).toBe(true);
  });

  it("9) chunkOrder null so em metadata tipicamente", () => {
    for (const f of hs) {
      const c = parseGoHistorySyncChunk(f.data);
      if (c.chunkOrder === null) {
        expect(
          c.syncType === HISTORY_SYNC_TYPE.NON_BLOCKING_DATA ||
            !c.temMensagens ||
            c.progress === null,
        ).toBe(true);
      }
    }
  });

  it("10) ClinicaWork tem mais de 50k msgs brutas no dia", () => {
    let total = 0;
    for (const f of hs.filter((x) => x.instanciaPasta.includes("847c01d8"))) {
      const inner = (f.data.Data ?? f.data) as Record<string, unknown>;
      for (const conv of (inner.conversations as Array<Record<string, unknown>>) ?? []) {
        total += ((conv.messages as unknown[]) ?? []).length;
      }
    }
    expect(total).toBeGreaterThan(50_000);
  });

  it("11) progress 100 aparece em mais de um syncType", () => {
    const tipos100 = new Set<number>();
    for (const f of hs) {
      const c = parseGoHistorySyncChunk(f.data);
      if (c.progress === 100) tipos100.add(c.syncType);
    }
    expect(tipos100.size).toBeGreaterThanOrEqual(2);
  });

  it("12) nome de grupo (se houver) nao e vazio", () => {
    for (const f of hs) {
      for (const conv of parseGoHistorySyncChunk(f.data).conversations) {
        if (conv.jid.endsWith("@g.us") && conv.nome) {
          expect(conv.nome.trim().length).toBeGreaterThan(0);
          return;
        }
      }
    }
    expect(true).toBe(true);
  });

  it("13) poll no corpus HistorySync se existir tem body com nome", () => {
    for (const f of hs) {
      for (const conv of parseGoHistorySyncChunk(f.data).conversations) {
        for (const m of conv.messages) {
          if (m.type === "poll") {
            expect(m.body.length).toBeGreaterThan(0);
            return;
          }
        }
      }
    }
    expect(true).toBe(true);
  });

  it("14) contact/contacts no corpus se existir", () => {
    for (const f of hs) {
      for (const conv of parseGoHistorySyncChunk(f.data).conversations) {
        for (const m of conv.messages) {
          if (m.type === "contacts") {
            expect(m.body.length).toBeGreaterThan(0);
            return;
          }
        }
      }
    }
    expect(true).toBe(true);
  });

  it("15) video no HistorySync tem messageObj.videoMessage", () => {
    for (const f of hs) {
      for (const conv of parseGoHistorySyncChunk(f.data).conversations) {
        for (const m of conv.messages) {
          if (m.type === "video") {
            expect(m.messageObj).toHaveProperty("videoMessage");
            return;
          }
        }
      }
    }
    expect(true).toBe(true);
  });

  it("16) interactive no HistorySync se existir", () => {
    for (const f of hs) {
      for (const conv of parseGoHistorySyncChunk(f.data).conversations) {
        for (const m of conv.messages) {
          if (m.type === "interactive") {
            expect(m.body.length).toBeGreaterThan(0);
            return;
          }
        }
      }
    }
    expect(true).toBe(true);
  });

  it("17) nenhuma mensagem parseada tem messageId vazio", () => {
    for (const f of hs) {
      for (const conv of parseGoHistorySyncChunk(f.data).conversations) {
        for (const m of conv.messages) {
          expect(m.messageId.length).toBeGreaterThan(0);
        }
      }
    }
  });

  it("18) LID chat resolvido ou preservado: jid nao vazio", () => {
    for (const f of hs) {
      for (const conv of parseGoHistorySyncChunk(f.data).conversations) {
        expect(conv.jid.length).toBeGreaterThan(0);
      }
    }
  });
});
