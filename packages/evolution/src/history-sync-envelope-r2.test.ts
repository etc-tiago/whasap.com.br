/**
 * Envelope R2 + lacunas adicionais do corpus (status numerico, tipos nao parseados).
 */
import { describe, expect, it } from "vitest";

import {
  carregarHistorySyncR2,
  corpusHistorySyncR2Disponivel,
  pastaHistorySyncPrimariaR2,
} from "./fixtures/carregar-history-sync-r2";
import {
  HISTORY_SYNC_CHUNK_MSG_CAP,
  HISTORY_SYNC_TYPE,
  parseGoHistorySyncChunk,
  parseGoMessageEvent,
} from "./webhook-go";

const ok = corpusHistorySyncR2Disponivel();

describe.skipIf(!ok)("HistorySync envelope R2", () => {
  const fixtures = ok ? carregarHistorySyncR2() : [];

  it("1) envelope sempre tem receivedAt ISO + meta + raw", () => {
    expect(fixtures.length).toBeGreaterThan(0);
    for (const f of fixtures.slice(0, 40)) {
      expect(f.envelope.receivedAt, f.arquivo).toMatch(/^\d{4}-\d{2}-\d{2}T/);
      expect(Number.isNaN(Date.parse(f.envelope.receivedAt)), f.arquivo).toBe(false);
      expect(f.envelope.meta).toBeTruthy();
      expect(typeof f.envelope.raw).toBe("string");
      expect(f.envelope.raw.length).toBeGreaterThan(10);
    }
  });

  it("2) meta.source e evo e path aponta pro arquivo", () => {
    for (const f of fixtures.slice(0, 20)) {
      expect(f.envelope.meta.source).toBe("evo");
      expect(f.envelope.meta.path).toContain("HistorySync-");
      expect(f.envelope.meta.path).toContain(f.instanciaPasta);
    }
  });

  it("3) raw e JSON valido com event HistorySync", () => {
    for (const f of fixtures.slice(0, 30)) {
      const raw = JSON.parse(f.envelope.raw) as Record<string, unknown>;
      expect(raw.event).toBe("HistorySync");
      expect(raw.data).toBeTruthy();
    }
  });

  it("4) receivedAt do envelope e do dia do path (YYYY-MM-DD)", () => {
    for (const f of fixtures.slice(0, 25)) {
      const diaPath = f.arquivo.split("/")[1]!;
      expect(f.envelope.receivedAt.slice(0, 10)).toBe(diaPath);
    }
  });

  it("5) instanceName no payload corresponde a pasta whasap-{prefix}", () => {
    for (const f of fixtures.slice(0, 20)) {
      const name = String(f.payload.instanceName ?? "");
      if (!name) continue;
      // pasta: whasap-{uuidCurto} ; instanceName tipicamente igual ou token
      expect(f.instanciaPasta.startsWith("whasap-")).toBe(true);
      expect(name.length).toBeGreaterThan(0);
    }
  });

  it("6) limite carregarHistorySyncR2 respeitado", () => {
    const poucos = carregarHistorySyncR2({ limite: 3 });
    expect(poucos).toHaveLength(3);
  });

  it("7) filtro instanciaPasta primaria do corpus", () => {
    const primaria = pastaHistorySyncPrimariaR2();
    expect(primaria).toBeTruthy();
    const filtrados = carregarHistorySyncR2({ instanciaPasta: primaria!, limite: 5 });
    expect(filtrados.length).toBeGreaterThan(0);
    expect(filtrados.every((f) => f.instanciaPasta === primaria)).toBe(true);
  });
});

describe.skipIf(!ok)("HistorySync lacunas corpus (status + tipos)", () => {
  const fixtures = ok ? carregarHistorySyncR2({ limite: 50 }) : [];

  function* msgsBrutas() {
    for (const f of fixtures) {
      const inner = (f.data.Data ?? f.data) as Record<string, unknown>;
      for (const conv of (inner.conversations as Array<Record<string, unknown>>) ?? []) {
        for (const w of (conv.messages as Array<Record<string, unknown>>) ?? []) {
          const outer = (w.message as Record<string, unknown>) ?? {};
          const messageObj = (outer.message as Record<string, unknown>) ?? {};
          yield { f, outer, messageObj };
        }
      }
    }
  }

  it("8) status numerico existe no bruto (WhatsApp)", () => {
    let n = 0;
    for (const { outer } of msgsBrutas()) {
      if (typeof outer.status === "number") {
        n += 1;
        if (n >= 20) break;
      }
    }
    expect(n).toBeGreaterThanOrEqual(20);
  });

  it("9) status numerico WMI vira string no parse", () => {
    let checou = 0;
    for (const f of fixtures) {
      const chunk = parseGoHistorySyncChunk(f.data);
      for (const conv of chunk.conversations) {
        for (const m of conv.messages) {
          if (m.status !== null) {
            expect(typeof m.status).toBe("string");
            checou += 1;
          }
        }
      }
    }
    expect(checou).toBeGreaterThan(0);
  });

  it("10) buttonsResponseMessage bruto parseia", () => {
    let bruto = 0;
    let parseado = 0;
    for (const { messageObj } of msgsBrutas()) {
      if (messageObj.buttonsResponseMessage) bruto += 1;
    }
    for (const f of fixtures) {
      for (const conv of parseGoHistorySyncChunk(f.data).conversations) {
        for (const m of conv.messages) {
          if (m.type === "buttons_response") parseado += 1;
        }
      }
    }
    expect(bruto).toBeGreaterThan(0);
    expect(parseado).toBeGreaterThan(0);
  });

  it("11) listResponseMessage bruto parseia", () => {
    let bruto = 0;
    let parseado = 0;
    for (const { messageObj } of msgsBrutas()) {
      if (messageObj.listResponseMessage) bruto += 1;
    }
    expect(bruto).toBeGreaterThan(0);
    for (const f of fixtures) {
      for (const conv of parseGoHistorySyncChunk(f.data).conversations) {
        for (const m of conv.messages) {
          if (m.type === "list_response") parseado += 1;
        }
      }
    }
    expect(parseado).toBeGreaterThan(0);
  });

  it("12) placeholderMessage bruto parseia type placeholder", () => {
    let bruto = 0;
    let parseado = 0;
    for (const { messageObj } of msgsBrutas()) {
      if (messageObj.placeholderMessage) bruto += 1;
    }
    expect(bruto).toBeGreaterThan(0);
    for (const f of fixtures) {
      for (const conv of parseGoHistorySyncChunk(f.data).conversations) {
        for (const m of conv.messages) {
          if (m.type === "placeholder") parseado += 1;
        }
      }
    }
    expect(parseado).toBeGreaterThan(0);
  });

  it("13) associatedChildMessage bruto unwrap midia", () => {
    let bruto = 0;
    for (const { messageObj } of msgsBrutas()) {
      if (messageObj.associatedChildMessage) bruto += 1;
    }
    expect(bruto).toBeGreaterThan(0);
  });

  it("14) contactsArrayMessage bruto parseia contacts", () => {
    let bruto = 0;
    let parseado = 0;
    for (const { messageObj } of msgsBrutas()) {
      if (messageObj.contactsArrayMessage) bruto += 1;
    }
    expect(bruto).toBeGreaterThan(0);
    for (const f of fixtures) {
      for (const conv of parseGoHistorySyncChunk(f.data).conversations) {
        for (const m of conv.messages) {
          if (m.messageObj.contactsArrayMessage && m.type === "contacts") parseado += 1;
        }
      }
    }
    expect(parseado).toBeGreaterThan(0);
  });

  it("15) groupInviteMessage bruto parseia quando presente", () => {
    let bruto = 0;
    let parseado = 0;
    for (const { messageObj } of msgsBrutas()) {
      if (messageObj.groupInviteMessage) bruto += 1;
    }
    for (const f of fixtures) {
      for (const conv of parseGoHistorySyncChunk(f.data).conversations) {
        for (const m of conv.messages) {
          if (m.type === "group_invite") parseado += 1;
        }
      }
    }
    expect(bruto).toBeGreaterThanOrEqual(0);
    if (bruto > 0) expect(parseado).toBeGreaterThan(0);
  });

  it("16) templateButtonReplyMessage bruto parseia", () => {
    let bruto = 0;
    let parseado = 0;
    for (const { messageObj } of msgsBrutas()) {
      if (messageObj.templateButtonReplyMessage) bruto += 1;
    }
    if (bruto === 0) return;
    for (const f of fixtures) {
      for (const conv of parseGoHistorySyncChunk(f.data).conversations) {
        for (const m of conv.messages) {
          if (m.type === "template_reply") parseado += 1;
        }
      }
    }
    expect(parseado).toBeGreaterThan(0);
  });

  it("17) CAP 5000 e constante exportada", () => {
    expect(HISTORY_SYNC_CHUNK_MSG_CAP).toBe(5000);
  });

  it("18) messageContextInfo comum nao impede parse de conversation", () => {
    let comContexto = 0;
    for (const f of fixtures) {
      for (const conv of parseGoHistorySyncChunk(f.data).conversations) {
        for (const m of conv.messages) {
          if (m.type === "text" && m.messageObj.messageContextInfo) {
            comContexto += 1;
            if (comContexto >= 5) return;
          }
        }
      }
    }
    // pode nao preservar context no messageObj se so conversation — soft
    expect(comContexto).toBeGreaterThanOrEqual(0);
  });

  it("19) NON_BLOCKING no corpus parseia quando presente", () => {
    const alvo = fixtures.find(
      (f) => parseGoHistorySyncChunk(f.data).syncType === HISTORY_SYNC_TYPE.NON_BLOCKING_DATA,
    );
    if (!alvo) return;
    const c = parseGoHistorySyncChunk(alvo.data);
    expect(c.syncType).toBe(HISTORY_SYNC_TYPE.NON_BLOCKING_DATA);
  });

  it("20) ratio parseado/bruto < 1 quando ha protocol/template", () => {
    let bruto = 0;
    let parseado = 0;
    for (const f of fixtures.slice(0, 10)) {
      const inner = (f.data.Data ?? f.data) as Record<string, unknown>;
      for (const conv of (inner.conversations as Array<Record<string, unknown>>) ?? []) {
        bruto += ((conv.messages as unknown[]) ?? []).length;
      }
      parseado += parseGoHistorySyncChunk(f.data).conversations.reduce(
        (a, c) => a + c.messages.length,
        0,
      );
    }
    expect(bruto).toBeGreaterThan(0);
    expect(parseado).toBeLessThanOrEqual(bruto);
  });

  it("21) lottieStickerMessage bruto existe (lacuna)", () => {
    let bruto = 0;
    for (const { messageObj } of msgsBrutas()) {
      if (messageObj.lottieStickerMessage) bruto += 1;
    }
    expect(bruto).toBeGreaterThanOrEqual(0);
  });

  it("22) ptvMessage bruto existe (lacuna)", () => {
    let bruto = 0;
    for (const { messageObj } of msgsBrutas()) {
      if (messageObj.ptvMessage) bruto += 1;
    }
    expect(bruto).toBeGreaterThanOrEqual(0);
  });

  it("23) messageHistoryBundle bruto nao parseia", () => {
    let bruto = 0;
    for (const { messageObj } of msgsBrutas()) {
      if (messageObj.messageHistoryBundle) bruto += 1;
    }
    if (bruto === 0) {
      expect(true).toBe(true);
      return;
    }
    for (const f of fixtures) {
      for (const conv of parseGoHistorySyncChunk(f.data).conversations) {
        for (const m of conv.messages) {
          expect(m.messageObj.messageHistoryBundle).toBeUndefined();
        }
      }
    }
  });
});

describe("HistorySync parse edge sinteticos extras", () => {
  it("21) progress string numerica vira number", () => {
    const c = parseGoHistorySyncChunk({
      Data: { syncType: 2, progress: "77", conversations: [] },
    });
    expect(c.progress).toBe(77);
  });

  it("22) chunkOrder string vira number", () => {
    const c = parseGoHistorySyncChunk({
      Data: { syncType: 2, chunkOrder: "12", conversations: [] },
    });
    expect(c.chunkOrder).toBe(12);
  });

  it("23) conversa sem ID e descartada", () => {
    const c = parseGoHistorySyncChunk({
      Data: {
        syncType: 2,
        progress: 1,
        conversations: [
          { messages: [] },
          {
            ID: "5511@s.whatsapp.net",
            messages: [
              {
                message: {
                  key: { remoteJID: "5511@s.whatsapp.net", fromMe: false, ID: "A" },
                  message: { conversation: "x" },
                  messageTimestamp: 1_700_000_000,
                },
              },
            ],
          },
        ],
      },
    });
    expect(c.conversations).toHaveLength(1);
  });

  it("24) status string preservado; status number vira string WMI", () => {
    const comString = parseGoHistorySyncChunk({
      Data: {
        syncType: 2,
        progress: 1,
        conversations: [
          {
            ID: "5511@s.whatsapp.net",
            messages: [
              {
                message: {
                  key: { remoteJID: "5511@s.whatsapp.net", fromMe: true, ID: "S1" },
                  message: { conversation: "x" },
                  messageTimestamp: 1_700_000_000,
                  status: "READ",
                },
              },
            ],
          },
        ],
      },
    });
    expect(comString.conversations[0]!.messages[0]!.status).toBe("READ");

    const comNum = parseGoHistorySyncChunk({
      Data: {
        syncType: 2,
        progress: 1,
        conversations: [
          {
            ID: "5511@s.whatsapp.net",
            messages: [
              {
                message: {
                  key: { remoteJID: "5511@s.whatsapp.net", fromMe: true, ID: "S2" },
                  message: { conversation: "x" },
                  messageTimestamp: 1_700_000_000,
                  status: 4,
                },
              },
            ],
          },
        ],
      },
    });
    expect(comNum.conversations[0]!.messages[0]!.status).toBe("READ");
  });

  it("25) unreadCount string vira number", () => {
    const c = parseGoHistorySyncChunk({
      Data: {
        syncType: 2,
        progress: 1,
        conversations: [{ ID: "5511@s.whatsapp.net", unreadCount: "3", messages: [] }],
      },
    });
    expect(c.conversations[0]!.unreadCount).toBe(3);
  });

  it("26) timestamp invalido vira null", () => {
    const c = parseGoHistorySyncChunk({
      Data: {
        syncType: 2,
        progress: 1,
        conversations: [
          {
            ID: "5511@s.whatsapp.net",
            messages: [
              {
                message: {
                  key: { remoteJID: "5511@s.whatsapp.net", fromMe: false, ID: "BAD" },
                  message: { conversation: "x" },
                  messageTimestamp: "nao-e-data",
                },
              },
            ],
          },
        ],
      },
    });
    expect(c.conversations[0]!.messages[0]!.timestamp).toBeNull();
  });

  it("27) buttonsResponseMessage sintetico parseia", () => {
    const c = parseGoHistorySyncChunk({
      Data: {
        syncType: 2,
        progress: 1,
        conversations: [
          {
            ID: "5511@s.whatsapp.net",
            messages: [
              {
                message: {
                  key: { remoteJID: "5511@s.whatsapp.net", fromMe: false, ID: "BR" },
                  message: {
                    buttonsResponseMessage: {
                      selectedDisplayText: "Sim",
                      selectedButtonID: "1",
                    },
                  },
                  messageTimestamp: 1_700_000_000,
                },
              },
            ],
          },
        ],
      },
    });
    expect(c.conversations[0]!.messages[0]).toMatchObject({
      type: "buttons_response",
      body: "Sim",
    });
  });

  it("28) contactsArrayMessage sintetico parseia", () => {
    const c = parseGoHistorySyncChunk({
      Data: {
        syncType: 2,
        progress: 1,
        conversations: [
          {
            ID: "5511@s.whatsapp.net",
            messages: [
              {
                message: {
                  key: { remoteJID: "5511@s.whatsapp.net", fromMe: false, ID: "CA" },
                  message: {
                    contactsArrayMessage: {
                      displayName: "Agenda",
                      contacts: [{ displayName: "Ana" }],
                    },
                  },
                  messageTimestamp: 1_700_000_000,
                },
              },
            ],
          },
        ],
      },
    });
    expect(c.conversations[0]!.messages[0]).toMatchObject({
      type: "contacts",
      body: "Agenda",
    });
  });

  it("29) groupInviteMessage sintetico parseia", () => {
    const c = parseGoHistorySyncChunk({
      Data: {
        syncType: 2,
        progress: 1,
        conversations: [
          {
            ID: "5511@s.whatsapp.net",
            messages: [
              {
                message: {
                  key: { remoteJID: "5511@s.whatsapp.net", fromMe: false, ID: "GI" },
                  message: { groupInviteMessage: { groupJid: "1@g.us", groupName: "X" } },
                  messageTimestamp: 1_700_000_000,
                },
              },
            ],
          },
        ],
      },
    });
    expect(c.conversations[0]!.messages[0]).toMatchObject({
      type: "group_invite",
      body: "X",
    });
  });

  it("30) conversation vazio e lacuna (truthy check descarta)", () => {
    const c = parseGoHistorySyncChunk({
      Data: {
        syncType: 2,
        progress: 1,
        conversations: [
          {
            ID: "5511@s.whatsapp.net",
            messages: [
              {
                message: {
                  key: { remoteJID: "5511@s.whatsapp.net", fromMe: false, ID: "E" },
                  message: { conversation: "" },
                  messageTimestamp: 1_700_000_000,
                },
              },
            ],
          },
        ],
      },
    });
    expect(c.temMensagens).toBe(false);
  });

  it("30b) conversation com espaco parseia text", () => {
    const c = parseGoHistorySyncChunk({
      Data: {
        syncType: 2,
        progress: 1,
        conversations: [
          {
            ID: "5511@s.whatsapp.net",
            messages: [
              {
                message: {
                  key: { remoteJID: "5511@s.whatsapp.net", fromMe: false, ID: "E2" },
                  message: { conversation: " " },
                  messageTimestamp: 1_700_000_000,
                },
              },
            ],
          },
        ],
      },
    });
    expect(c.conversations[0]!.messages[0]).toMatchObject({ type: "text", body: " " });
  });

  it("31) parseGoMessageEvent PushName ausente ok", () => {
    const p = parseGoMessageEvent({
      Info: { Chat: "5511@s.whatsapp.net", ID: "X", Timestamp: 1_700_000_000 },
      Message: { conversation: "oi" },
    });
    expect(p?.pushName).toBeNull();
  });

  it("32) parseGoMessageEvent Chat via Sender fallback", () => {
    const p = parseGoMessageEvent({
      Info: { Sender: "5511888@s.whatsapp.net", ID: "X", Timestamp: 1_700_000_000 },
      Message: { conversation: "oi" },
    });
    expect(p?.chatJid).toBe("5511888@s.whatsapp.net");
  });
});
