/**
 * fatiarHistorySyncData - utilitario de testes/reprocessamento.
 */
import { describe, expect, it } from "vitest";

import { fatiarHistorySyncData } from "./fixtures/carregar-history-sync-r2";
import { parseGoHistorySyncChunk } from "./webhook-go";

function chunkCom(nMsgs: number, nConvs = 1): Record<string, unknown> {
  const conversations = Array.from({ length: nConvs }, (_, ci) => ({
    ID: `5511${ci}@s.whatsapp.net`,
    messages: Array.from({ length: nMsgs }, (_, mi) => ({
      message: {
        key: {
          remoteJID: `5511${ci}@s.whatsapp.net`,
          fromMe: false,
          ID: `C${ci}-M${mi}`,
        },
        message: { conversation: `msg ${ci}-${mi}` },
        messageTimestamp: 1_700_000_000 + mi,
      },
    })),
  }));
  return {
    Data: {
      syncType: 2,
      progress: 40,
      chunkOrder: 3,
      phoneNumberToLidMappings: [{ pnJID: "5511@s.whatsapp.net", lidJID: "1@lid" }],
      conversations,
    },
  };
}

describe("fatiarHistorySyncData", () => {
  it("1) max 0 zera mensagens", () => {
    const fatia = parseGoHistorySyncChunk(fatiarHistorySyncData(chunkCom(5), 0));
    expect(fatia.temMensagens).toBe(false);
  });

  it("2) max 2 de 5", () => {
    const fatia = parseGoHistorySyncChunk(fatiarHistorySyncData(chunkCom(5), 2));
    const n = fatia.conversations.reduce((a, c) => a + c.messages.length, 0);
    expect(n).toBe(2);
  });

  it("3) preserva syncType progress chunkOrder", () => {
    const fatia = parseGoHistorySyncChunk(fatiarHistorySyncData(chunkCom(3), 1));
    expect(fatia.syncType).toBe(2);
    expect(fatia.progress).toBe(40);
    expect(fatia.chunkOrder).toBe(3);
  });

  it("4) preserva mappings", () => {
    const fatia = parseGoHistorySyncChunk(fatiarHistorySyncData(chunkCom(3), 1));
    expect(fatia.phoneLidMappings).toHaveLength(1);
  });

  it("5) distribui entre conversas ate esgotar max", () => {
    const fatia = parseGoHistorySyncChunk(fatiarHistorySyncData(chunkCom(3, 3), 4));
    const n = fatia.conversations.reduce((a, c) => a + c.messages.length, 0);
    expect(n).toBe(4);
    expect(fatia.conversations.length).toBeGreaterThanOrEqual(2);
  });

  it("6) max maior que total devolve tudo", () => {
    const fatia = parseGoHistorySyncChunk(fatiarHistorySyncData(chunkCom(3), 100));
    expect(fatia.conversations.reduce((a, c) => a + c.messages.length, 0)).toBe(3);
  });

  it("7) data flat (sem Data) tambem funciona", () => {
    const flat = {
      syncType: 3,
      progress: 10,
      conversations: [
        {
          ID: "5511@s.whatsapp.net",
          messages: [
            {
              message: {
                key: { remoteJID: "5511@s.whatsapp.net", fromMe: false, ID: "X" },
                message: { conversation: "x" },
                messageTimestamp: 1_700_000_000,
              },
            },
          ],
        },
      ],
    };
    const fatia = parseGoHistorySyncChunk(fatiarHistorySyncData(flat, 1));
    expect(fatia.syncType).toBe(3);
    expect(fatia.temMensagens).toBe(true);
  });

  it("8) nao muta o objeto original", () => {
    const original = chunkCom(3);
    const before = JSON.stringify(original);
    fatiarHistorySyncData(original, 1);
    expect(JSON.stringify(original)).toBe(before);
  });

  it("9) max negativo trata como 0 msgs uteis", () => {
    const fatia = parseGoHistorySyncChunk(fatiarHistorySyncData(chunkCom(5), -1));
    expect(fatia.temMensagens).toBe(false);
  });

  it("10) conversas vazias sao preservadas no caminho", () => {
    const data = {
      Data: {
        syncType: 2,
        progress: 5,
        conversations: [
          { ID: "vazio@s.whatsapp.net", messages: [] },
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
    };
    const fatia = parseGoHistorySyncChunk(fatiarHistorySyncData(data, 1));
    expect(fatia.conversations.some((c) => c.jid === "vazio@s.whatsapp.net")).toBe(true);
    expect(fatia.conversations.reduce((a, c) => a + c.messages.length, 0)).toBe(1);
  });

  it("11) progress null preservado", () => {
    const data = {
      Data: {
        syncType: 5,
        conversations: [
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
    };
    const fatia = parseGoHistorySyncChunk(fatiarHistorySyncData(data, 1));
    expect(fatia.progress).toBeNull();
  });
});
