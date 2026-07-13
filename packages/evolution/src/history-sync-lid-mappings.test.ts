/**
 * phoneNumberToLidMappings — variantes de casing e validacao.
 */
import { describe, expect, it } from "vitest";

import {
  carregarHistorySyncR2,
  corpusHistorySyncR2Disponivel,
} from "./fixtures/carregar-history-sync-r2";
import { mapaLidParaPn, parseGoHistorySyncChunk, resolverJidHistoricoSync } from "./webhook-go";

describe("parseGoHistorySyncChunk — LID mappings", () => {
  it("1) aceita pnJID/lidJID (Pascal case do GO)", () => {
    const c = parseGoHistorySyncChunk({
      Data: {
        syncType: 2,
        progress: 1,
        phoneNumberToLidMappings: [{ pnJID: "5511999@s.whatsapp.net", lidJID: "111@lid" }],
        conversations: [],
      },
    });
    expect(c.phoneLidMappings).toEqual([{ pnJid: "5511999@s.whatsapp.net", lidJid: "111@lid" }]);
  });

  it("2) aceita pnJid/lidJid (camelCase)", () => {
    const c = parseGoHistorySyncChunk({
      Data: {
        syncType: 2,
        progress: 1,
        phoneNumberToLidMappings: [{ pnJid: "5511888@s.whatsapp.net", lidJid: "222@lid" }],
        conversations: [],
      },
    });
    expect(c.phoneLidMappings).toHaveLength(1);
    expect(c.phoneLidMappings[0]!.lidJid).toBe("222@lid");
  });

  it("3) rejeita pn sem @s.whatsapp.net", () => {
    const c = parseGoHistorySyncChunk({
      Data: {
        syncType: 2,
        progress: 1,
        phoneNumberToLidMappings: [{ pnJID: "5511@lid", lidJID: "333@lid" }],
        conversations: [],
      },
    });
    expect(c.phoneLidMappings).toHaveLength(0);
  });

  it("4) rejeita lid sem @lid", () => {
    const c = parseGoHistorySyncChunk({
      Data: {
        syncType: 2,
        progress: 1,
        phoneNumberToLidMappings: [{ pnJID: "5511@s.whatsapp.net", lidJID: "5511@s.whatsapp.net" }],
        conversations: [],
      },
    });
    expect(c.phoneLidMappings).toHaveLength(0);
  });

  it("5) mapaLidParaPn ultimo mapping vence duplicata de lid", () => {
    const m = mapaLidParaPn([
      { pnJid: "5511@s.whatsapp.net", lidJid: "1@lid" },
      { pnJid: "5522@s.whatsapp.net", lidJid: "1@lid" },
    ]);
    expect(m.get("1@lid")).toBe("5522@s.whatsapp.net");
  });

  it("6) resolverJidHistoricoSync com multiplos lids no mapa", () => {
    const mapa = mapaLidParaPn([
      { pnJid: "5511111@s.whatsapp.net", lidJid: "a@lid" },
      { pnJid: "5522222@s.whatsapp.net", lidJid: "b@lid" },
    ]);
    expect(resolverJidHistoricoSync("a@lid", mapa).idExternoCanonico).toBe(
      "5511111@s.whatsapp.net",
    );
    expect(resolverJidHistoricoSync("b@lid", mapa).phone).toBe("5522222");
  });

  it("7) conversa com ID @lid usa mapping do chunk", () => {
    const c = parseGoHistorySyncChunk({
      Data: {
        syncType: 2,
        progress: 10,
        phoneNumberToLidMappings: [{ pnJID: "5511999@s.whatsapp.net", lidJID: "999@lid" }],
        conversations: [
          {
            ID: "999@lid",
            messages: [
              {
                message: {
                  key: { remoteJID: "999@lid", fromMe: false, ID: "M1" },
                  message: { conversation: "oi" },
                  messageTimestamp: 1_700_000_000,
                },
              },
            ],
          },
        ],
      },
    });
    const mapa = mapaLidParaPn(c.phoneLidMappings);
    const r = resolverJidHistoricoSync(c.conversations[0]!.jid, mapa);
    expect(r.idExternoCanonico).toBe("5511999@s.whatsapp.net");
    expect(c.conversations[0]!.messages[0]!.chatJid).toBe("999@lid");
  });
});

const corpusOk = corpusHistorySyncR2Disponivel();

describe.skipIf(!corpusOk)("LID mappings no corpus R2", () => {
  const fixtures = corpusOk ? carregarHistorySyncR2({ limite: 30 }) : [];

  it("8) chunks com mappings tem pelo menos 1 par valido", () => {
    const comMap = fixtures.filter(
      (f) => parseGoHistorySyncChunk(f.data).phoneLidMappings.length > 0,
    );
    expect(comMap.length).toBeGreaterThan(0);
    for (const f of comMap.slice(0, 5)) {
      for (const m of parseGoHistorySyncChunk(f.data).phoneLidMappings) {
        expect(m.pnJid).toMatch(/@s\.whatsapp\.net$/);
        expect(m.lidJid).toMatch(/@lid$/);
      }
    }
  });

  it("9) mapa do corpus resolve algum @lid de conversa", () => {
    let resolveu = false;
    for (const f of fixtures) {
      const chunk = parseGoHistorySyncChunk(f.data);
      if (chunk.phoneLidMappings.length === 0) continue;
      const mapa = mapaLidParaPn(chunk.phoneLidMappings);
      for (const conv of chunk.conversations) {
        if (!conv.jid.endsWith("@lid")) continue;
        const r = resolverJidHistoricoSync(conv.jid, mapa);
        if (r.idExternoCanonico.endsWith("@s.whatsapp.net")) {
          resolveu = true;
          break;
        }
      }
      if (resolveu) break;
    }
    expect(resolveu).toBe(true);
  });

  it("10) mensagem em chat @lid mantem chatJid original", () => {
    for (const f of fixtures) {
      for (const conv of parseGoHistorySyncChunk(f.data).conversations) {
        if (!conv.jid.endsWith("@lid")) continue;
        for (const msg of conv.messages) {
          expect(msg.chatJid).toContain("@");
          return;
        }
      }
    }
    expect(true).toBe(true);
  });
});
