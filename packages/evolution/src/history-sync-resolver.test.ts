/**
 * resolverJidHistoricoSync + mapaLidParaPn + parse edge cases sinteticos.
 */
import { describe, expect, it } from "vitest";

import {
  deveIgnorarHistorySyncChunk,
  HISTORY_SYNC_TYPE,
  historySyncConcluido,
  jidParaTelefone,
  mapaLidParaPn,
  parseGoHistorySyncChunk,
  resolverJidHistoricoSync,
} from "./webhook-go";

describe("mapaLidParaPn", () => {
  it("1) mapa vazio", () => {
    expect(mapaLidParaPn([]).size).toBe(0);
  });

  it("2) mapeia lid -> pn", () => {
    const m = mapaLidParaPn([
      { pnJid: "5511999@s.whatsapp.net", lidJid: "111@lid" },
      { pnJid: "5511888@s.whatsapp.net", lidJid: "222@lid" },
    ]);
    expect(m.get("111@lid")).toBe("5511999@s.whatsapp.net");
    expect(m.get("222@lid")).toBe("5511888@s.whatsapp.net");
  });
});

describe("resolverJidHistoricoSync", () => {
  const mapa = mapaLidParaPn([{ pnJid: "5511999999999@s.whatsapp.net", lidJid: "999@lid" }]);

  it("3) grupo @g.us preserva jid", () => {
    const r = resolverJidHistoricoSync("120363@g.us", mapa);
    expect(r.idExternoCanonico).toBe("120363@g.us");
    expect(r.idExternoLinha).toBe("120363@g.us");
  });

  it("4) lid com mapping vira PN", () => {
    const r = resolverJidHistoricoSync("999@lid", mapa);
    expect(r.idExternoCanonico).toBe("5511999999999@s.whatsapp.net");
    expect(r.idExternoLinha).toBe("999@lid");
    expect(r.phone).toBe("5511999999999");
  });

  it("5) lid sem mapping fica lid", () => {
    const r = resolverJidHistoricoSync("888@lid", mapa);
    expect(r.idExternoCanonico).toBe("888@lid");
    expect(r.idExternoLinha).toBe("888@lid");
  });

  it("6) s.whatsapp.net canonico = jid", () => {
    const r = resolverJidHistoricoSync("5511888@s.whatsapp.net", mapa);
    expect(r.idExternoCanonico).toBe("5511888@s.whatsapp.net");
    expect(r.phone).toBe("5511888");
  });

  it("7) jid sem sufixo conhecido monta s.whatsapp.net", () => {
    const r = resolverJidHistoricoSync("5511777", mapa);
    expect(r.idExternoCanonico).toBe("5511777@s.whatsapp.net");
    expect(r.phone).toBe(jidParaTelefone("5511777"));
  });

  it("8) broadcast jid cai no fallback", () => {
    const r = resolverJidHistoricoSync("status@broadcast", new Map());
    expect(r.phone).toBeTruthy();
    expect(r.idExternoLinha).toBeTruthy();
  });
});

describe("parseGoHistorySyncChunk - sinteticos", () => {
  it("9) Data aninhado", () => {
    const chunk = parseGoHistorySyncChunk({
      Data: {
        syncType: HISTORY_SYNC_TYPE.RECENT,
        progress: 100,
        conversations: [
          {
            ID: "5511@s.whatsapp.net",
            messages: [
              {
                message: {
                  key: { remoteJID: "5511@s.whatsapp.net", fromMe: false, ID: "ABC" },
                  message: { conversation: "oi" },
                  messageTimestamp: 1_700_000_000,
                },
              },
            ],
          },
        ],
      },
    });
    expect(chunk.temMensagens).toBe(true);
    expect(historySyncConcluido(chunk)).toBe(true);
    expect(chunk.conversations[0]!.messages[0]!.body).toBe("oi");
  });

  it("10) syncType ausente vira -1 e sem msgs e ignorado", () => {
    const chunk = parseGoHistorySyncChunk({ Data: { conversations: [] } });
    expect(chunk.syncType).toBe(-1);
    expect(deveIgnorarHistorySyncChunk(chunk)).toBe(true);
  });

  it("11) conversa sem ID e pulada", () => {
    const chunk = parseGoHistorySyncChunk({
      Data: {
        syncType: 2,
        progress: 10,
        conversations: [
          {
            messages: [
              {
                message: {
                  key: { remoteJID: "x", fromMe: false, ID: "1" },
                  message: { conversation: "x" },
                  messageTimestamp: 1_700_000_000,
                },
              },
            ],
          },
        ],
      },
    });
    expect(chunk.conversations).toHaveLength(0);
    expect(chunk.temMensagens).toBe(false);
  });

  it("12) mensagem sem key e descartada", () => {
    const chunk = parseGoHistorySyncChunk({
      Data: {
        syncType: 2,
        progress: 10,
        conversations: [
          {
            ID: "5511@s.whatsapp.net",
            messages: [{ message: { message: { conversation: "x" }, messageTimestamp: 1 } }],
          },
        ],
      },
    });
    expect(chunk.conversations[0]!.messages).toHaveLength(0);
  });

  it("13) mensagem sem messageObj e descartada", () => {
    const chunk = parseGoHistorySyncChunk({
      Data: {
        syncType: 2,
        progress: 10,
        conversations: [
          {
            ID: "5511@s.whatsapp.net",
            messages: [
              {
                message: {
                  key: { remoteJID: "5511@s.whatsapp.net", fromMe: false, ID: "Z" },
                  messageTimestamp: 1_700_000_000,
                },
              },
            ],
          },
        ],
      },
    });
    expect(chunk.conversations[0]!.messages).toHaveLength(0);
  });

  it("14) protocolMessage sozinho nao vira mensagem parseada", () => {
    const chunk = parseGoHistorySyncChunk({
      Data: {
        syncType: 2,
        progress: 10,
        conversations: [
          {
            ID: "5511@s.whatsapp.net",
            messages: [
              {
                message: {
                  key: { remoteJID: "5511@s.whatsapp.net", fromMe: false, ID: "P1" },
                  message: { protocolMessage: { type: 1 } },
                  messageTimestamp: 1_700_000_000,
                },
              },
            ],
          },
        ],
      },
    });
    expect(chunk.temMensagens).toBe(false);
  });

  it("15) templateMessage sozinho nao parseia (lacuna conhecida)", () => {
    const chunk = parseGoHistorySyncChunk({
      Data: {
        syncType: 2,
        progress: 10,
        conversations: [
          {
            ID: "5511@s.whatsapp.net",
            messages: [
              {
                message: {
                  key: { remoteJID: "5511@s.whatsapp.net", fromMe: true, ID: "T1" },
                  message: { templateMessage: { hydratedTemplate: {} } },
                  messageTimestamp: 1_700_000_000,
                },
              },
            ],
          },
        ],
      },
    });
    expect(chunk.temMensagens).toBe(false);
  });

  it("16) imageMessage parseia type image", () => {
    const chunk = parseGoHistorySyncChunk({
      Data: {
        syncType: 2,
        progress: 10,
        conversations: [
          {
            ID: "5511@s.whatsapp.net",
            messages: [
              {
                message: {
                  key: { remoteJID: "5511@s.whatsapp.net", fromMe: false, ID: "IMG1" },
                  message: { imageMessage: { caption: "foto", mimetype: "image/jpeg" } },
                  messageTimestamp: 1_700_000_000,
                },
              },
            ],
          },
        ],
      },
    });
    expect(chunk.conversations[0]!.messages[0]!.type).toBe("image");
    expect(chunk.conversations[0]!.messages[0]!.body).toBe("foto");
  });

  it("17) audioMessage parseia", () => {
    const chunk = parseGoHistorySyncChunk({
      Data: {
        syncType: 3,
        progress: 50,
        conversations: [
          {
            ID: "5511@s.whatsapp.net",
            messages: [
              {
                message: {
                  key: { remoteJID: "5511@s.whatsapp.net", fromMe: true, ID: "AUD1" },
                  message: { audioMessage: { mimetype: "audio/ogg" } },
                  messageTimestamp: 1_700_000_000,
                },
              },
            ],
          },
        ],
      },
    });
    expect(chunk.conversations[0]!.messages[0]!.type).toBe("audio");
  });

  it("18) documentMessage usa fileName", () => {
    const chunk = parseGoHistorySyncChunk({
      Data: {
        syncType: 2,
        progress: 1,
        conversations: [
          {
            ID: "5511@s.whatsapp.net",
            messages: [
              {
                message: {
                  key: { remoteJID: "5511@s.whatsapp.net", fromMe: false, ID: "DOC1" },
                  message: { documentMessage: { fileName: "contrato.pdf" } },
                  messageTimestamp: 1_700_000_000,
                },
              },
            ],
          },
        ],
      },
    });
    expect(chunk.conversations[0]!.messages[0]!.body).toBe("contrato.pdf");
    expect(chunk.conversations[0]!.messages[0]!.type).toBe("document");
  });

  it("19) extendedTextMessage", () => {
    const chunk = parseGoHistorySyncChunk({
      Data: {
        syncType: 2,
        progress: 1,
        conversations: [
          {
            ID: "5511@s.whatsapp.net",
            messages: [
              {
                message: {
                  key: { remoteJID: "5511@s.whatsapp.net", fromMe: false, ID: "EXT1" },
                  message: { extendedTextMessage: { text: "link https://x" } },
                  messageTimestamp: 1_700_000_000,
                },
              },
            ],
          },
        ],
      },
    });
    expect(chunk.conversations[0]!.messages[0]!.body).toContain("link");
    expect(chunk.conversations[0]!.messages[0]!.type).toBe("text");
  });

  it("20) phoneNumberToLidMappings invalido e ignorado", () => {
    const chunk = parseGoHistorySyncChunk({
      Data: {
        syncType: 2,
        progress: 1,
        phoneNumberToLidMappings: [{ pnJID: "x", lidJID: "y" }, null, "nope"],
        conversations: [],
      },
    });
    expect(chunk.phoneLidMappings).toHaveLength(0);
  });

  it("21) mapping so aceita pn @s.whatsapp.net e lid @lid", () => {
    const chunk = parseGoHistorySyncChunk({
      Data: {
        syncType: 2,
        progress: 1,
        phoneNumberToLidMappings: [
          { pnJID: "5511@s.whatsapp.net", lidJID: "1@lid" },
          { pnJID: "5511@lid", lidJID: "2@lid" },
          { pnJID: "5511@s.whatsapp.net", lidJID: "3@s.whatsapp.net" },
        ],
        conversations: [],
      },
    });
    expect(chunk.phoneLidMappings).toHaveLength(1);
    expect(chunk.phoneLidMappings[0]!.lidJid).toBe("1@lid");
  });

  it("22) key.id minusculo tambem funciona", () => {
    const chunk = parseGoHistorySyncChunk({
      Data: {
        syncType: 2,
        progress: 1,
        conversations: [
          {
            ID: "5511@s.whatsapp.net",
            messages: [
              {
                message: {
                  key: { remoteJid: "5511@s.whatsapp.net", fromMe: false, id: "lower" },
                  message: { conversation: "hi" },
                  messageTimestamp: 1_700_000_000,
                },
              },
            ],
          },
        ],
      },
    });
    expect(chunk.conversations[0]!.messages[0]!.messageId).toBe("lower");
  });

  it("23) timestamp string ISO", () => {
    const chunk = parseGoHistorySyncChunk({
      Data: {
        syncType: 2,
        progress: 1,
        conversations: [
          {
            ID: "5511@s.whatsapp.net",
            messages: [
              {
                message: {
                  key: { remoteJID: "5511@s.whatsapp.net", fromMe: false, ID: "ISO1" },
                  message: { conversation: "hi" },
                  messageTimestamp: "2024-09-18T14:27:40.000Z",
                },
              },
            ],
          },
        ],
      },
    });
    expect(chunk.conversations[0]!.messages[0]!.timestamp?.toISOString()).toBe(
      "2024-09-18T14:27:40.000Z",
    );
  });

  it("24) timestamp em ms (>1e12) nao multiplica de novo", () => {
    const ms = Date.parse("2024-09-18T14:27:40.000Z");
    const chunk = parseGoHistorySyncChunk({
      Data: {
        syncType: 2,
        progress: 1,
        conversations: [
          {
            ID: "5511@s.whatsapp.net",
            messages: [
              {
                message: {
                  key: { remoteJID: "5511@s.whatsapp.net", fromMe: false, ID: "MS1" },
                  message: { conversation: "hi" },
                  messageTimestamp: ms,
                },
              },
            ],
          },
        ],
      },
    });
    expect(chunk.conversations[0]!.messages[0]!.timestamp?.getTime()).toBe(ms);
  });

  it("25) FULL@100 com msgs nao conclui", () => {
    const chunk = parseGoHistorySyncChunk({
      Data: {
        syncType: HISTORY_SYNC_TYPE.FULL,
        progress: 100,
        conversations: [
          {
            ID: "5511@s.whatsapp.net",
            messages: [
              {
                message: {
                  key: { remoteJID: "5511@s.whatsapp.net", fromMe: false, ID: "F1" },
                  message: { conversation: "x" },
                  messageTimestamp: 1_700_000_000,
                },
              },
            ],
          },
        ],
      },
    });
    expect(historySyncConcluido(chunk)).toBe(false);
    expect(deveIgnorarHistorySyncChunk(chunk)).toBe(false);
  });

  it("26) editedMessage sozinho nao parseia (lacuna)", () => {
    const chunk = parseGoHistorySyncChunk({
      Data: {
        syncType: 2,
        progress: 1,
        conversations: [
          {
            ID: "5511@s.whatsapp.net",
            messages: [
              {
                message: {
                  key: { remoteJID: "5511@s.whatsapp.net", fromMe: false, ID: "ED1" },
                  message: { editedMessage: { message: { conversation: "editado" } } },
                  messageTimestamp: 1_700_000_000,
                },
              },
            ],
          },
        ],
      },
    });
    expect(chunk.temMensagens).toBe(false);
  });

  it("27) message sem inner.message descartada", () => {
    const chunk = parseGoHistorySyncChunk({
      Data: {
        syncType: 2,
        progress: 1,
        conversations: [
          {
            ID: "5511@s.whatsapp.net",
            messages: [{ message: { key: { ID: "X" }, messageTimestamp: 1 } }],
          },
        ],
      },
    });
    expect(chunk.temMensagens).toBe(false);
  });

  it("28) remoteJid minusculo no key funciona", () => {
    const chunk = parseGoHistorySyncChunk({
      Data: {
        syncType: 2,
        progress: 1,
        conversations: [
          {
            ID: "5511@s.whatsapp.net",
            messages: [
              {
                message: {
                  key: { remoteJid: "5511@s.whatsapp.net", fromMe: false, id: "RJ1" },
                  message: { conversation: "ok" },
                  messageTimestamp: 1_700_000_000,
                },
              },
            ],
          },
        ],
      },
    });
    expect(chunk.conversations[0]!.messages[0]!.chatJid).toBe("5511@s.whatsapp.net");
  });

  it("29) syncType string numerica vira number", () => {
    const chunk = parseGoHistorySyncChunk({
      Data: { syncType: "2", progress: 1, conversations: [] },
    });
    expect(chunk.syncType).toBe(2);
  });

  it("30) phoneNumberToLidMappings ausente = array vazio", () => {
    const chunk = parseGoHistorySyncChunk({
      Data: { syncType: 2, progress: 1, conversations: [] },
    });
    expect(chunk.phoneLidMappings).toEqual([]);
  });
});
