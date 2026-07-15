/**
 * processarHistorySyncChunk com ingerirMensagem mockado (sem Postgres).
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { HISTORY_SYNC_TYPE } from "@whasap/evolution";

const ingerirMensagem = vi.fn();

vi.mock("./ingestao-mensagem", () => ({
  ingerirMensagem: (...args: unknown[]) => ingerirMensagem(...args),
  // preserva export usado por history-sync-timestamp.test no mesmo processo bun test
  isoTimestampParaSql: (nova: Date) =>
    Number.isNaN(nova.getTime()) ? new Date().toISOString() : nova.toISOString(),
}));

const updates: Array<Record<string, unknown>> = [];

function dbMock() {
  return {
    update: () => ({
      set: (patch: Record<string, unknown>) => {
        updates.push(patch);
        return {
          where: async () => undefined,
        };
      },
    }),
  };
}

async function load() {
  return import("./history-sync");
}

describe("processarHistorySyncChunk (unit)", () => {
  beforeEach(() => {
    ingerirMensagem.mockReset();
    updates.length = 0;
    ingerirMensagem.mockResolvedValue({
      messageId: 1,
      conversaId: 1,
      created: true,
      midiaR2Chave: null,
    });
  });

  const instance = {
    id: 42,
    organizacaoId: 7,
    uuid: "11111111-1111-4111-8111-111111111111",
    evoToken: "tok",
  };

  it("1) metadata NON_BLOCKING retorna ignorado sem ingerir", async () => {
    const { processarHistorySyncChunk } = await load();
    const result = await processarHistorySyncChunk(dbMock() as never, instance, {
      Data: { syncType: HISTORY_SYNC_TYPE.NON_BLOCKING_DATA, conversations: [] },
    });
    expect(result.ignorado).toBe(true);
    expect(ingerirMensagem).not.toHaveBeenCalled();
  });

  it("2) chunk sem msgs retorna ignorado", async () => {
    const { processarHistorySyncChunk } = await load();
    const result = await processarHistorySyncChunk(dbMock() as never, instance, {
      Data: { syncType: HISTORY_SYNC_TYPE.RECENT, progress: 10, conversations: [] },
    });
    expect(result.ignorado).toBe(true);
    expect(ingerirMensagem).not.toHaveBeenCalled();
  });

  it("3) chunk util chama ingerirMensagem por mensagem", async () => {
    const { processarHistorySyncChunk } = await load();
    const result = await processarHistorySyncChunk(dbMock() as never, instance, {
      Data: {
        syncType: HISTORY_SYNC_TYPE.RECENT,
        progress: 40,
        conversations: [
          {
            ID: "5511999@s.whatsapp.net",
            messages: [
              {
                message: {
                  key: { remoteJID: "5511999@s.whatsapp.net", fromMe: false, ID: "M1" },
                  message: { conversation: "a" },
                  messageTimestamp: 1_700_000_000,
                },
              },
              {
                message: {
                  key: { remoteJID: "5511999@s.whatsapp.net", fromMe: true, ID: "M2" },
                  message: { conversation: "b" },
                  messageTimestamp: 1_700_000_100,
                },
              },
            ],
          },
        ],
      },
    });
    expect(result.ignorado).toBe(false);
    expect(ingerirMensagem).toHaveBeenCalledTimes(2);
  });

  it("4) passa origemHistorico e syncType nos metadados", async () => {
    const { processarHistorySyncChunk } = await load();
    await processarHistorySyncChunk(dbMock() as never, instance, {
      Data: {
        syncType: HISTORY_SYNC_TYPE.FULL,
        progress: 12,
        conversations: [
          {
            ID: "5511999@s.whatsapp.net",
            messages: [
              {
                message: {
                  key: { remoteJID: "5511999@s.whatsapp.net", fromMe: false, ID: "MX" },
                  message: { conversation: "x" },
                  messageTimestamp: 1_700_000_000,
                },
              },
            ],
          },
        ],
      },
    });
    const args = ingerirMensagem.mock.calls[0]![1] as {
      metadados: Record<string, unknown>;
      type: string;
    };
    expect(args.metadados.origemHistorico).toBe(true);
    expect(args.metadados.syncType).toBe(HISTORY_SYNC_TYPE.FULL);
  });

  it("5) imagem com token gera midiaJob", async () => {
    const { processarHistorySyncChunk } = await load();
    const result = await processarHistorySyncChunk(dbMock() as never, instance, {
      Data: {
        syncType: HISTORY_SYNC_TYPE.RECENT,
        progress: 20,
        conversations: [
          {
            ID: "5511999@s.whatsapp.net",
            messages: [
              {
                message: {
                  key: { remoteJID: "5511999@s.whatsapp.net", fromMe: false, ID: "IMG" },
                  message: { imageMessage: { mimetype: "image/jpeg", caption: "c" } },
                  messageTimestamp: 1_700_000_000,
                },
              },
            ],
          },
        ],
      },
    });
    expect(result.midiaJobs).toHaveLength(1);
    expect(result.midiaJobs[0]!.type).toBe("image");
    expect(result.midiaJobs[0]!.externalId).toBe("IMG");
    expect(result.midiaJobs[0]!.provider).toBe("evo");
    if (result.midiaJobs[0]!.provider === "evo") {
      expect(result.midiaJobs[0]!.origem).toBe("history_sync");
    }
  });

  it("6) imagem sem token nao gera midiaJob", async () => {
    const { processarHistorySyncChunk } = await load();
    const result = await processarHistorySyncChunk(
      dbMock() as never,
      { ...instance, evoToken: null },
      {
        Data: {
          syncType: HISTORY_SYNC_TYPE.RECENT,
          progress: 20,
          conversations: [
            {
              ID: "5511999@s.whatsapp.net",
              messages: [
                {
                  message: {
                    key: { remoteJID: "5511999@s.whatsapp.net", fromMe: false, ID: "IMG2" },
                    message: { imageMessage: { mimetype: "image/jpeg" } },
                    messageTimestamp: 1_700_000_000,
                  },
                },
              ],
            },
          ],
        },
      },
    );
    expect(result.midiaJobs).toHaveLength(0);
  });

  it("7) midia ja com midiaR2Chave nao reenfileira", async () => {
    ingerirMensagem.mockResolvedValue({
      messageId: 9,
      conversaId: 1,
      created: false,
      midiaR2Chave: "cdn/x",
    });
    const { processarHistorySyncChunk } = await load();
    const result = await processarHistorySyncChunk(dbMock() as never, instance, {
      Data: {
        syncType: HISTORY_SYNC_TYPE.RECENT,
        progress: 20,
        conversations: [
          {
            ID: "5511999@s.whatsapp.net",
            messages: [
              {
                message: {
                  key: { remoteJID: "5511999@s.whatsapp.net", fromMe: false, ID: "IMG3" },
                  message: { imageMessage: { mimetype: "image/jpeg" } },
                  messageTimestamp: 1_700_000_000,
                },
              },
            ],
          },
        ],
      },
    });
    expect(result.midiaJobs).toHaveLength(0);
  });

  it("8) RECENT@100 marca concluido e atualiza progresso", async () => {
    const { processarHistorySyncChunk } = await load();
    const result = await processarHistorySyncChunk(dbMock() as never, instance, {
      Data: {
        syncType: HISTORY_SYNC_TYPE.RECENT,
        progress: 100,
        conversations: [
          {
            ID: "5511999@s.whatsapp.net",
            messages: [
              {
                message: {
                  key: { remoteJID: "5511999@s.whatsapp.net", fromMe: false, ID: "DONE" },
                  message: { conversation: "fim" },
                  messageTimestamp: 1_700_000_000,
                },
              },
            ],
          },
        ],
      },
    });
    expect(result.concluido).toBe(true);
    expect(updates.some((u) => u.historicoSyncStatus === "completed")).toBe(true);
  });

  it("9) FULL@100 nao marca completed", async () => {
    const { processarHistorySyncChunk } = await load();
    const result = await processarHistorySyncChunk(dbMock() as never, instance, {
      Data: {
        syncType: HISTORY_SYNC_TYPE.FULL,
        progress: 100,
        conversations: [
          {
            ID: "5511999@s.whatsapp.net",
            messages: [
              {
                message: {
                  key: { remoteJID: "5511999@s.whatsapp.net", fromMe: false, ID: "FULL" },
                  message: { conversation: "x" },
                  messageTimestamp: 1_700_000_000,
                },
              },
            ],
          },
        ],
      },
    });
    expect(result.concluido).toBe(false);
    expect(updates.some((u) => u.historicoSyncStatus === "completed")).toBe(false);
  });

  it("10) ordena por timestamp antes de ingerir", async () => {
    const { processarHistorySyncChunk } = await load();
    await processarHistorySyncChunk(dbMock() as never, instance, {
      Data: {
        syncType: HISTORY_SYNC_TYPE.RECENT,
        progress: 30,
        conversations: [
          {
            ID: "5511999@s.whatsapp.net",
            messages: [
              {
                message: {
                  key: { remoteJID: "5511999@s.whatsapp.net", fromMe: false, ID: "NEW" },
                  message: { conversation: "nova" },
                  messageTimestamp: 1_700_000_200,
                },
              },
              {
                message: {
                  key: { remoteJID: "5511999@s.whatsapp.net", fromMe: false, ID: "OLD" },
                  message: { conversation: "velha" },
                  messageTimestamp: 1_700_000_000,
                },
              },
            ],
          },
        ],
      },
    });
    const ids = ingerirMensagem.mock.calls.map((c) => (c[1] as { externalId: string }).externalId);
    expect(ids).toEqual(["OLD", "NEW"]);
  });

  it("11) LID com mapping passa idExternoCanonico PN", async () => {
    const { processarHistorySyncChunk } = await load();
    await processarHistorySyncChunk(dbMock() as never, instance, {
      Data: {
        syncType: HISTORY_SYNC_TYPE.RECENT,
        progress: 30,
        phoneNumberToLidMappings: [{ pnJID: "5511888@s.whatsapp.net", lidJID: "777@lid" }],
        conversations: [
          {
            ID: "777@lid",
            messages: [
              {
                message: {
                  key: { remoteJID: "777@lid", fromMe: false, ID: "LID1" },
                  message: { conversation: "via lid" },
                  messageTimestamp: 1_700_000_000,
                },
              },
            ],
          },
        ],
      },
    });
    const args = ingerirMensagem.mock.calls[0]![1] as {
      idExternoCanonico: string;
      idExternoLinha: string;
    };
    expect(args.idExternoCanonico).toBe("5511888@s.whatsapp.net");
    expect(args.idExternoLinha).toBe("777@lid");
  });

  it("12) direcao outbound quando fromMe", async () => {
    const { processarHistorySyncChunk } = await load();
    await processarHistorySyncChunk(dbMock() as never, instance, {
      Data: {
        syncType: HISTORY_SYNC_TYPE.RECENT,
        progress: 30,
        conversations: [
          {
            ID: "5511999@s.whatsapp.net",
            messages: [
              {
                message: {
                  key: { remoteJID: "5511999@s.whatsapp.net", fromMe: true, ID: "OUT" },
                  message: { conversation: "eu" },
                  messageTimestamp: 1_700_000_000,
                },
              },
            ],
          },
        ],
      },
    });
    expect((ingerirMensagem.mock.calls[0]![1] as { direcao: string }).direcao).toBe("outbound");
  });

  it("13) text nao gera midiaJob", async () => {
    const { processarHistorySyncChunk } = await load();
    const result = await processarHistorySyncChunk(dbMock() as never, instance, {
      Data: {
        syncType: HISTORY_SYNC_TYPE.RECENT,
        progress: 30,
        conversations: [
          {
            ID: "5511999@s.whatsapp.net",
            messages: [
              {
                message: {
                  key: { remoteJID: "5511999@s.whatsapp.net", fromMe: false, ID: "TXT" },
                  message: { conversation: "so texto" },
                  messageTimestamp: 1_700_000_000,
                },
              },
            ],
          },
        ],
      },
    });
    expect(result.midiaJobs).toHaveLength(0);
  });

  it("14) progress retornado reflete chunk", async () => {
    const { processarHistorySyncChunk } = await load();
    const result = await processarHistorySyncChunk(dbMock() as never, instance, {
      Data: {
        syncType: HISTORY_SYNC_TYPE.RECENT,
        progress: 73,
        conversations: [
          {
            ID: "5511999@s.whatsapp.net",
            messages: [
              {
                message: {
                  key: { remoteJID: "5511999@s.whatsapp.net", fromMe: false, ID: "P" },
                  message: { conversation: "p" },
                  messageTimestamp: 1_700_000_000,
                },
              },
            ],
          },
        ],
      },
    });
    expect(result.progress).toBe(73);
  });

  it("15) sticker gera midiaJob", async () => {
    const { processarHistorySyncChunk } = await load();
    const result = await processarHistorySyncChunk(dbMock() as never, instance, {
      Data: {
        syncType: HISTORY_SYNC_TYPE.RECENT,
        progress: 30,
        conversations: [
          {
            ID: "5511999@s.whatsapp.net",
            messages: [
              {
                message: {
                  key: { remoteJID: "5511999@s.whatsapp.net", fromMe: false, ID: "STK" },
                  message: { stickerMessage: { mimetype: "image/webp" } },
                  messageTimestamp: 1_700_000_000,
                },
              },
            ],
          },
        ],
      },
    });
    expect(result.midiaJobs[0]!.type).toBe("sticker");
  });

  it("16) video gera midiaJob", async () => {
    const { processarHistorySyncChunk } = await load();
    const result = await processarHistorySyncChunk(dbMock() as never, instance, {
      Data: {
        syncType: HISTORY_SYNC_TYPE.RECENT,
        progress: 30,
        conversations: [
          {
            ID: "5511999@s.whatsapp.net",
            messages: [
              {
                message: {
                  key: { remoteJID: "5511999@s.whatsapp.net", fromMe: false, ID: "VID" },
                  message: { videoMessage: { mimetype: "video/mp4", caption: "v" } },
                  messageTimestamp: 1_700_000_000,
                },
              },
            ],
          },
        ],
      },
    });
    expect(result.midiaJobs).toHaveLength(1);
    expect(result.midiaJobs[0]!.type).toBe("video");
  });

  it("17) document gera midiaJob com fileName", async () => {
    const { processarHistorySyncChunk } = await load();
    const result = await processarHistorySyncChunk(dbMock() as never, instance, {
      Data: {
        syncType: HISTORY_SYNC_TYPE.RECENT,
        progress: 30,
        conversations: [
          {
            ID: "5511999@s.whatsapp.net",
            messages: [
              {
                message: {
                  key: { remoteJID: "5511999@s.whatsapp.net", fromMe: false, ID: "DOC" },
                  message: { documentMessage: { fileName: "a.pdf", mimetype: "application/pdf" } },
                  messageTimestamp: 1_700_000_000,
                },
              },
            ],
          },
        ],
      },
    });
    expect(result.midiaJobs[0]!.type).toBe("document");
    expect(result.midiaJobs[0]!.fileName).toBe("a.pdf");
  });

  it("18) audio gera midiaJob", async () => {
    const { processarHistorySyncChunk } = await load();
    const result = await processarHistorySyncChunk(dbMock() as never, instance, {
      Data: {
        syncType: HISTORY_SYNC_TYPE.RECENT,
        progress: 30,
        conversations: [
          {
            ID: "5511999@s.whatsapp.net",
            messages: [
              {
                message: {
                  key: { remoteJID: "5511999@s.whatsapp.net", fromMe: false, ID: "AUD" },
                  message: { audioMessage: { mimetype: "audio/ogg" } },
                  messageTimestamp: 1_700_000_000,
                },
              },
            ],
          },
        ],
      },
    });
    expect(result.midiaJobs[0]!.type).toBe("audio");
  });

  it("19) multiplas conversas ingerem todas", async () => {
    const { processarHistorySyncChunk } = await load();
    await processarHistorySyncChunk(dbMock() as never, instance, {
      Data: {
        syncType: HISTORY_SYNC_TYPE.RECENT,
        progress: 30,
        conversations: [
          {
            ID: "5511111@s.whatsapp.net",
            messages: [
              {
                message: {
                  key: { remoteJID: "5511111@s.whatsapp.net", fromMe: false, ID: "A1" },
                  message: { conversation: "a" },
                  messageTimestamp: 1_700_000_000,
                },
              },
            ],
          },
          {
            ID: "5511222@s.whatsapp.net",
            messages: [
              {
                message: {
                  key: { remoteJID: "5511222@s.whatsapp.net", fromMe: false, ID: "B1" },
                  message: { conversation: "b" },
                  messageTimestamp: 1_700_000_001,
                },
              },
            ],
          },
        ],
      },
    });
    expect(ingerirMensagem).toHaveBeenCalledTimes(2);
  });

  it("20) ingerirMensagem null nao quebra e nao cria midiaJob", async () => {
    ingerirMensagem.mockResolvedValue(null);
    const { processarHistorySyncChunk } = await load();
    const result = await processarHistorySyncChunk(dbMock() as never, instance, {
      Data: {
        syncType: HISTORY_SYNC_TYPE.RECENT,
        progress: 30,
        conversations: [
          {
            ID: "5511999@s.whatsapp.net",
            messages: [
              {
                message: {
                  key: { remoteJID: "5511999@s.whatsapp.net", fromMe: false, ID: "NULL" },
                  message: { imageMessage: { mimetype: "image/jpeg" } },
                  messageTimestamp: 1_700_000_000,
                },
              },
            ],
          },
        ],
      },
    });
    expect(result.ignorado).toBe(false);
    expect(result.midiaJobs).toHaveLength(0);
  });

  it("21) STATUS_V3S@100 com msgs nao marca completed da instancia", async () => {
    const { processarHistorySyncChunk } = await load();
    const result = await processarHistorySyncChunk(dbMock() as never, instance, {
      Data: {
        syncType: HISTORY_SYNC_TYPE.PUSH_NAMES,
        progress: 100,
        conversations: [
          {
            ID: "5511999@s.whatsapp.net",
            messages: [
              {
                message: {
                  key: { remoteJID: "5511999@s.whatsapp.net", fromMe: false, ID: "OD" },
                  message: { conversation: "on demand" },
                  messageTimestamp: 1_700_000_000,
                },
              },
            ],
          },
        ],
      },
    });
    expect(result.concluido).toBe(false);
    expect(updates.some((u) => u.historicoSyncStatus === "completed")).toBe(false);
  });

  it("22) grupo @g.us passa idExternoCanonico do grupo", async () => {
    const { processarHistorySyncChunk } = await load();
    await processarHistorySyncChunk(dbMock() as never, instance, {
      Data: {
        syncType: HISTORY_SYNC_TYPE.RECENT,
        progress: 30,
        conversations: [
          {
            ID: "120363@g.us",
            name: "Grupo",
            messages: [
              {
                message: {
                  key: { remoteJID: "120363@g.us", fromMe: true, ID: "G1" },
                  message: { conversation: "ola grupo" },
                  messageTimestamp: 1_700_000_000,
                },
              },
            ],
          },
        ],
      },
    });
    const args = ingerirMensagem.mock.calls[0]![1] as {
      idExternoCanonico: string;
      contactName: string | null;
    };
    expect(args.idExternoCanonico).toBe("120363@g.us");
    expect(args.contactName).toBe("Grupo");
  });

  it("23) heartbeat running gravado em chunk util", async () => {
    updates.length = 0;
    const { processarHistorySyncChunk } = await load();
    await processarHistorySyncChunk(dbMock() as never, instance, {
      Data: {
        syncType: HISTORY_SYNC_TYPE.FULL,
        progress: 50,
        conversations: [
          {
            ID: "5511999@s.whatsapp.net",
            messages: [
              {
                message: {
                  key: { remoteJID: "5511999@s.whatsapp.net", fromMe: false, ID: "HB" },
                  message: { conversation: "hb" },
                  messageTimestamp: 1_700_000_000,
                },
              },
            ],
          },
        ],
      },
    });
    expect(updates.some((u) => u.historicoSyncStatus === "running")).toBe(true);
    expect(updates.some((u) => u.historicoSincronizandoEm instanceof Date)).toBe(true);
  });

  it("24) poll e ingerido como type poll", async () => {
    const { processarHistorySyncChunk } = await load();
    await processarHistorySyncChunk(dbMock() as never, instance, {
      Data: {
        syncType: HISTORY_SYNC_TYPE.RECENT,
        progress: 20,
        conversations: [
          {
            ID: "5511999@s.whatsapp.net",
            messages: [
              {
                message: {
                  key: { remoteJID: "5511999@s.whatsapp.net", fromMe: false, ID: "POLL1" },
                  message: {
                    pollCreationMessageV3: {
                      name: "Dia?",
                      options: [{ optionName: "Seg" }],
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
    const args = ingerirMensagem.mock.calls[0]![1] as { type: string; body: string };
    expect(args.type).toBe("poll");
    expect(args.body).toContain("Dia?");
  });

  it("25) reaction e ingerida", async () => {
    const { processarHistorySyncChunk } = await load();
    await processarHistorySyncChunk(dbMock() as never, instance, {
      Data: {
        syncType: HISTORY_SYNC_TYPE.RECENT,
        progress: 20,
        conversations: [
          {
            ID: "5511999@s.whatsapp.net",
            messages: [
              {
                message: {
                  key: { remoteJID: "5511999@s.whatsapp.net", fromMe: true, ID: "REAC1" },
                  message: { reactionMessage: { text: "🎉" } },
                  messageTimestamp: 1_700_000_000,
                },
              },
            ],
          },
        ],
      },
    });
    expect(ingerirMensagem.mock.calls[0]![1]).toMatchObject({ type: "reaction", body: "🎉" });
  });

  it("26) location e ingerida", async () => {
    const { processarHistorySyncChunk } = await load();
    await processarHistorySyncChunk(dbMock() as never, instance, {
      Data: {
        syncType: HISTORY_SYNC_TYPE.RECENT,
        progress: 20,
        conversations: [
          {
            ID: "5511999@s.whatsapp.net",
            messages: [
              {
                message: {
                  key: { remoteJID: "5511999@s.whatsapp.net", fromMe: false, ID: "LOC1" },
                  message: { locationMessage: {} },
                  messageTimestamp: 1_700_000_000,
                },
              },
            ],
          },
        ],
      },
    });
    expect(ingerirMensagem.mock.calls[0]![1]).toMatchObject({ type: "location" });
  });

  it("31) status string da msg e passado a ingerir", async () => {
    const { processarHistorySyncChunk } = await load();
    await processarHistorySyncChunk(dbMock() as never, instance, {
      Data: {
        syncType: HISTORY_SYNC_TYPE.RECENT,
        progress: 10,
        conversations: [
          {
            ID: "5511999@s.whatsapp.net",
            messages: [
              {
                message: {
                  key: { remoteJID: "5511999@s.whatsapp.net", fromMe: true, ID: "ST1" },
                  message: { conversation: "enviada" },
                  messageTimestamp: 1_700_000_000,
                  status: "READ",
                },
              },
            ],
          },
        ],
      },
    });
    expect(ingerirMensagem.mock.calls[0]![1]).toMatchObject({
      status: "READ",
      direcao: "outbound",
    });
  });

  it("32) inbound sem status usa delivered", async () => {
    const { processarHistorySyncChunk } = await load();
    await processarHistorySyncChunk(dbMock() as never, instance, {
      Data: {
        syncType: HISTORY_SYNC_TYPE.RECENT,
        progress: 10,
        conversations: [
          {
            ID: "5511999@s.whatsapp.net",
            messages: [
              {
                message: {
                  key: { remoteJID: "5511999@s.whatsapp.net", fromMe: false, ID: "IN1" },
                  message: { conversation: "oi" },
                  messageTimestamp: 1_700_000_000,
                },
              },
            ],
          },
        ],
      },
    });
    expect(ingerirMensagem.mock.calls[0]![1]).toMatchObject({
      status: "delivered",
      direcao: "inbound",
    });
  });

  it("33) outbound sem status usa sent", async () => {
    const { processarHistorySyncChunk } = await load();
    await processarHistorySyncChunk(dbMock() as never, instance, {
      Data: {
        syncType: HISTORY_SYNC_TYPE.RECENT,
        progress: 10,
        conversations: [
          {
            ID: "5511999@s.whatsapp.net",
            messages: [
              {
                message: {
                  key: { remoteJID: "5511999@s.whatsapp.net", fromMe: true, ID: "OUT1" },
                  message: { conversation: "ok" },
                  messageTimestamp: 1_700_000_000,
                },
              },
            ],
          },
        ],
      },
    });
    expect(ingerirMensagem.mock.calls[0]![1]).toMatchObject({ status: "sent" });
  });

  it("34) unreadCount da conversa vai em naoLidasInicial", async () => {
    const { processarHistorySyncChunk } = await load();
    await processarHistorySyncChunk(dbMock() as never, instance, {
      Data: {
        syncType: HISTORY_SYNC_TYPE.RECENT,
        progress: 10,
        conversations: [
          {
            ID: "5511999@s.whatsapp.net",
            unreadCount: 7,
            messages: [
              {
                message: {
                  key: { remoteJID: "5511999@s.whatsapp.net", fromMe: false, ID: "U1" },
                  message: { conversation: "oi" },
                  messageTimestamp: 1_700_000_000,
                },
              },
            ],
          },
        ],
      },
    });
    expect(ingerirMensagem.mock.calls[0]![1]).toMatchObject({ naoLidasInicial: 7 });
  });

  it("35) midiaJob carrega mimeType do imageMessage", async () => {
    const { processarHistorySyncChunk } = await load();
    const result = await processarHistorySyncChunk(dbMock() as never, instance, {
      Data: {
        syncType: HISTORY_SYNC_TYPE.RECENT,
        progress: 10,
        conversations: [
          {
            ID: "5511999@s.whatsapp.net",
            messages: [
              {
                message: {
                  key: { remoteJID: "5511999@s.whatsapp.net", fromMe: false, ID: "IMG2" },
                  message: { imageMessage: { mimetype: "image/png", caption: "p" } },
                  messageTimestamp: 1_700_000_000,
                },
              },
            ],
          },
        ],
      },
    });
    expect(result.midiaJobs[0]!.mimeType).toBe("image/png");
  });

  it("36) STATUS_V3S nao grava running na instancia", async () => {
    updates.length = 0;
    const { processarHistorySyncChunk } = await load();
    await processarHistorySyncChunk(dbMock() as never, instance, {
      Data: {
        syncType: HISTORY_SYNC_TYPE.PUSH_NAMES,
        progress: 50,
        conversations: [
          {
            ID: "5511999@s.whatsapp.net",
            messages: [
              {
                message: {
                  key: { remoteJID: "5511999@s.whatsapp.net", fromMe: false, ID: "OD1" },
                  message: { conversation: "od" },
                  messageTimestamp: 1_700_000_000,
                },
              },
            ],
          },
        ],
      },
    });
    expect(updates.some((u) => u.historicoSyncStatus === "running")).toBe(false);
    expect(ingerirMensagem).toHaveBeenCalled();
  });

  it("37) contact e event tambem ingerem", async () => {
    const { processarHistorySyncChunk } = await load();
    await processarHistorySyncChunk(dbMock() as never, instance, {
      Data: {
        syncType: HISTORY_SYNC_TYPE.RECENT,
        progress: 10,
        conversations: [
          {
            ID: "5511999@s.whatsapp.net",
            messages: [
              {
                message: {
                  key: { remoteJID: "5511999@s.whatsapp.net", fromMe: false, ID: "C1" },
                  message: { contactMessage: { displayName: "Ana" } },
                  messageTimestamp: 1_700_000_000,
                },
              },
              {
                message: {
                  key: { remoteJID: "5511999@s.whatsapp.net", fromMe: false, ID: "E1" },
                  message: { eventMessage: { name: "Reuniao" } },
                  messageTimestamp: 1_700_000_100,
                },
              },
            ],
          },
        ],
      },
    });
    expect(ingerirMensagem).toHaveBeenCalledTimes(2);
    expect(
      ingerirMensagem.mock.calls.map((c) => (c[1] as { type: string }).type).toSorted(),
    ).toEqual(["contacts", "event"]);
  });

  it("38) syncFase nos metadados e rotulo legivel", async () => {
    const { processarHistorySyncChunk } = await load();
    await processarHistorySyncChunk(dbMock() as never, instance, {
      Data: {
        syncType: HISTORY_SYNC_TYPE.FULL,
        progress: 10,
        conversations: [
          {
            ID: "5511999@s.whatsapp.net",
            messages: [
              {
                message: {
                  key: { remoteJID: "5511999@s.whatsapp.net", fromMe: false, ID: "F1" },
                  message: { conversation: "x" },
                  messageTimestamp: 1_700_000_000,
                },
              },
            ],
          },
        ],
      },
    });
    const meta = (ingerirMensagem.mock.calls[0]![1] as { metadados: Record<string, unknown> })
      .metadados;
    expect(meta.syncFase).toBe("completo");
    expect(meta.origemHistorico).toBe(true);
  });

  it("39) text nao inclui waMessage nos metadados", async () => {
    const { processarHistorySyncChunk } = await load();
    await processarHistorySyncChunk(dbMock() as never, instance, {
      Data: {
        syncType: HISTORY_SYNC_TYPE.RECENT,
        progress: 5,
        conversations: [
          {
            ID: "5511999@s.whatsapp.net",
            messages: [
              {
                message: {
                  key: { remoteJID: "5511999@s.whatsapp.net", fromMe: false, ID: "TXT1" },
                  message: { conversation: "ola" },
                  messageTimestamp: 1_700_000_000,
                },
              },
            ],
          },
        ],
      },
    });
    const meta = (ingerirMensagem.mock.calls[0]![1] as { metadados: Record<string, unknown> })
      .metadados;
    expect(meta.waMessage).toBeUndefined();
  });

  it("40) imagem inclui waMessage nos metadados", async () => {
    const { processarHistorySyncChunk } = await load();
    await processarHistorySyncChunk(dbMock() as never, instance, {
      Data: {
        syncType: HISTORY_SYNC_TYPE.RECENT,
        progress: 5,
        conversations: [
          {
            ID: "5511999@s.whatsapp.net",
            messages: [
              {
                message: {
                  key: { remoteJID: "5511999@s.whatsapp.net", fromMe: false, ID: "IMG3" },
                  message: { imageMessage: { mimetype: "image/jpeg" } },
                  messageTimestamp: 1_700_000_000,
                },
              },
            ],
          },
        ],
      },
    });
    const meta = (ingerirMensagem.mock.calls[0]![1] as { metadados: Record<string, unknown> })
      .metadados;
    expect(meta.waMessage).toBeTruthy();
  });

  it("41) midiaJob monta messageKey correto", async () => {
    const { processarHistorySyncChunk } = await load();
    const result = await processarHistorySyncChunk(dbMock() as never, instance, {
      Data: {
        syncType: HISTORY_SYNC_TYPE.RECENT,
        progress: 5,
        conversations: [
          {
            ID: "5511999@s.whatsapp.net",
            messages: [
              {
                message: {
                  key: { remoteJID: "5511999@s.whatsapp.net", fromMe: true, ID: "VID1" },
                  message: { videoMessage: { mimetype: "video/mp4" } },
                  messageTimestamp: 1_700_000_000,
                },
              },
            ],
          },
        ],
      },
    });
    const job = result.midiaJobs[0]!;
    expect(job.provider).toBe("evo");
    if (job.provider === "evo") {
      expect(job.messageKey).toEqual({
        remoteJid: "5511999@s.whatsapp.net",
        fromMe: true,
        id: "VID1",
      });
    }
  });

  it("42) interactive nao gera midiaJob", async () => {
    const { processarHistorySyncChunk } = await load();
    const result = await processarHistorySyncChunk(dbMock() as never, instance, {
      Data: {
        syncType: HISTORY_SYNC_TYPE.RECENT,
        progress: 5,
        conversations: [
          {
            ID: "5511999@s.whatsapp.net",
            messages: [
              {
                message: {
                  key: { remoteJID: "5511999@s.whatsapp.net", fromMe: false, ID: "INT1" },
                  message: { interactiveMessage: { body: { text: "flow" } } },
                  messageTimestamp: 1_700_000_000,
                },
              },
            ],
          },
        ],
      },
    });
    expect(result.midiaJobs).toHaveLength(0);
  });

  it("43) ignorado retorna progress do chunk metadata", async () => {
    const { processarHistorySyncChunk } = await load();
    const result = await processarHistorySyncChunk(dbMock() as never, instance, {
      Data: { syncType: HISTORY_SYNC_TYPE.NON_BLOCKING_DATA, progress: 33, conversations: [] },
    });
    expect(result).toMatchObject({ ignorado: true, progress: 33, concluido: false });
  });

  it("44) passa enviadoEm e ultimaMensagemEm do timestamp da msg", async () => {
    const ts = new Date("2024-09-18T14:27:40.000Z");
    const { processarHistorySyncChunk } = await load();
    await processarHistorySyncChunk(dbMock() as never, instance, {
      Data: {
        syncType: HISTORY_SYNC_TYPE.RECENT,
        progress: 5,
        conversations: [
          {
            ID: "5511999@s.whatsapp.net",
            messages: [
              {
                message: {
                  key: { remoteJID: "5511999@s.whatsapp.net", fromMe: false, ID: "TS1" },
                  message: { conversation: "data" },
                  messageTimestamp: ts.getTime(),
                },
              },
            ],
          },
        ],
      },
    });
    const args = ingerirMensagem.mock.calls[0]![1] as {
      enviadoEm: Date;
      ultimaMensagemEm: Date;
      provedor: string;
    };
    expect(args.enviadoEm?.getTime()).toBe(ts.getTime());
    expect(args.ultimaMensagemEm?.getTime()).toBe(ts.getTime());
    expect(args.provedor).toBe("evo");
  });

  it("45) document midiaJob inclui fileName", async () => {
    const { processarHistorySyncChunk } = await load();
    const result = await processarHistorySyncChunk(dbMock() as never, instance, {
      Data: {
        syncType: HISTORY_SYNC_TYPE.RECENT,
        progress: 5,
        conversations: [
          {
            ID: "5511999@s.whatsapp.net",
            messages: [
              {
                message: {
                  key: { remoteJID: "5511999@s.whatsapp.net", fromMe: false, ID: "DOC2" },
                  message: {
                    documentMessage: { fileName: "laudo.pdf", mimetype: "application/pdf" },
                  },
                  messageTimestamp: 1_700_000_000,
                },
              },
            ],
          },
        ],
      },
    });
    expect(result.midiaJobs[0]!.fileName).toBe("laudo.pdf");
    expect(result.midiaJobs[0]!.mimeType).toBe("application/pdf");
  });

  it("46) video midiaJob inclui mimeType", async () => {
    const { processarHistorySyncChunk } = await load();
    const result = await processarHistorySyncChunk(dbMock() as never, instance, {
      Data: {
        syncType: HISTORY_SYNC_TYPE.RECENT,
        progress: 5,
        conversations: [
          {
            ID: "5511999@s.whatsapp.net",
            messages: [
              {
                message: {
                  key: { remoteJID: "5511999@s.whatsapp.net", fromMe: false, ID: "VID2" },
                  message: { videoMessage: { mimetype: "video/mp4" } },
                  messageTimestamp: 1_700_000_000,
                },
              },
            ],
          },
        ],
      },
    });
    expect(result.midiaJobs[0]!.mimeType).toBe("video/mp4");
  });

  it("47) sticker midiaJob inclui mimeType", async () => {
    const { processarHistorySyncChunk } = await load();
    const result = await processarHistorySyncChunk(dbMock() as never, instance, {
      Data: {
        syncType: HISTORY_SYNC_TYPE.RECENT,
        progress: 5,
        conversations: [
          {
            ID: "5511999@s.whatsapp.net",
            messages: [
              {
                message: {
                  key: { remoteJID: "5511999@s.whatsapp.net", fromMe: false, ID: "STK2" },
                  message: { stickerMessage: { mimetype: "image/webp" } },
                  messageTimestamp: 1_700_000_000,
                },
              },
            ],
          },
        ],
      },
    });
    expect(result.midiaJobs[0]!.mimeType).toBe("image/webp");
  });

  it("48) audio midiaJob inclui mimeType", async () => {
    const { processarHistorySyncChunk } = await load();
    const result = await processarHistorySyncChunk(dbMock() as never, instance, {
      Data: {
        syncType: HISTORY_SYNC_TYPE.RECENT,
        progress: 5,
        conversations: [
          {
            ID: "5511999@s.whatsapp.net",
            messages: [
              {
                message: {
                  key: { remoteJID: "5511999@s.whatsapp.net", fromMe: false, ID: "AUD2" },
                  message: { audioMessage: { mimetype: "audio/ogg; codecs=opus" } },
                  messageTimestamp: 1_700_000_000,
                },
              },
            ],
          },
        ],
      },
    });
    expect(result.midiaJobs[0]!.mimeType).toBe("audio/ogg; codecs=opus");
  });

  it("49) contactName da conversa passa para ingerirMensagem", async () => {
    const { processarHistorySyncChunk } = await load();
    await processarHistorySyncChunk(dbMock() as never, instance, {
      Data: {
        syncType: HISTORY_SYNC_TYPE.RECENT,
        progress: 5,
        conversations: [
          {
            ID: "5511999@s.whatsapp.net",
            name: "Paciente Teste",
            messages: [
              {
                message: {
                  key: { remoteJID: "5511999@s.whatsapp.net", fromMe: false, ID: "NM1" },
                  message: { conversation: "oi" },
                  messageTimestamp: 1_700_000_000,
                },
              },
            ],
          },
        ],
      },
    });
    expect(ingerirMensagem.mock.calls[0]![1]).toMatchObject({
      contactName: "Paciente Teste",
    });
  });

  it("50) ingest em ordem cronologica (timestamps crescentes)", async () => {
    const ordem: string[] = [];
    ingerirMensagem.mockImplementation(async (_db, params: { externalId: string }) => {
      ordem.push(params.externalId);
      return { messageId: 1, conversaId: 1, created: true, midiaR2Chave: null };
    });
    const { processarHistorySyncChunk } = await load();
    await processarHistorySyncChunk(dbMock() as never, instance, {
      Data: {
        syncType: HISTORY_SYNC_TYPE.RECENT,
        progress: 5,
        conversations: [
          {
            ID: "5511999@s.whatsapp.net",
            messages: [
              {
                message: {
                  key: { remoteJID: "5511999@s.whatsapp.net", fromMe: false, ID: "T3" },
                  message: { conversation: "t3" },
                  messageTimestamp: 1_700_000_300,
                },
              },
              {
                message: {
                  key: { remoteJID: "5511999@s.whatsapp.net", fromMe: false, ID: "T1" },
                  message: { conversation: "t1" },
                  messageTimestamp: 1_700_000_100,
                },
              },
              {
                message: {
                  key: { remoteJID: "5511999@s.whatsapp.net", fromMe: false, ID: "T2" },
                  message: { conversation: "t2" },
                  messageTimestamp: 1_700_000_200,
                },
              },
            ],
          },
        ],
      },
    });
    expect(ordem).toEqual(["T1", "T2", "T3"]);
  });
});

describe("concluirHistoricosSyncOciosos (unit)", () => {
  it("27) sem rows ociosas retorna 0", async () => {
    const { concluirHistoricosSyncOciosos } = await load();
    const db = {
      query: {
        instanciaEvo: {
          findMany: async () => [],
        },
      },
      update: () => ({
        set: () => ({ where: async () => undefined }),
      }),
    };
    expect(await concluirHistoricosSyncOciosos(db as never, new Date())).toBe(0);
  });

  it("28) cada row ociosa recebe marcarConcluido", async () => {
    updates.length = 0;
    const { concluirHistoricosSyncOciosos } = await load();
    const db = {
      query: {
        instanciaEvo: {
          findMany: async () => [{ instanciaId: 10 }, { instanciaId: 20 }],
        },
      },
      update: () => ({
        set: (patch: Record<string, unknown>) => {
          updates.push(patch);
          return { where: async () => undefined };
        },
      }),
    };
    const n = await concluirHistoricosSyncOciosos(db as never, new Date("2026-07-13T12:00:00Z"));
    expect(n).toBe(2);
    expect(updates).toHaveLength(2);
    expect(updates.every((u) => u.historicoSyncStatus === "completed")).toBe(true);
    expect(updates.every((u) => u.historicoSincronizandoEm === null)).toBe(true);
  });
});

describe("atualizarProgressoHistoricoSync (unit)", () => {
  it("29) patch vazio nao chama update", async () => {
    let updateCalls = 0;
    const { atualizarProgressoHistoricoSync } = await load();
    const db = {
      update: () => {
        updateCalls += 1;
        return { set: () => ({ where: async () => undefined }) };
      },
    };
    await atualizarProgressoHistoricoSync(db as never, 1, {});
    expect(updateCalls).toBe(0);
  });

  it("30) failed grava erro", async () => {
    updates.length = 0;
    const { atualizarProgressoHistoricoSync } = await load();
    const db = {
      update: () => ({
        set: (patch: Record<string, unknown>) => {
          updates.push(patch);
          return { where: async () => undefined };
        },
      }),
    };
    await atualizarProgressoHistoricoSync(db as never, 99, {
      status: "failed",
      erro: "Fila HISTORY_SYNC_QUEUE não configurada",
    });
    expect(updates[0]).toMatchObject({
      historicoSyncStatus: "failed",
      historicoSyncErro: "Fila HISTORY_SYNC_QUEUE não configurada",
    });
  });
});
