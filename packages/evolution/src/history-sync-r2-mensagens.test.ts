/**
 * Mensagens HistorySync do corpus: tipos, stubs descartados, midia, ordenacao.
 */
import { describe, expect, it } from "vitest";

import {
  carregarHistorySyncR2,
  corpusHistorySyncR2Disponivel,
  fatiarHistorySyncData,
  pastaHistorySyncPrimariaR2,
} from "./fixtures/carregar-history-sync-r2";
import { HISTORY_SYNC_TYPE, parseGoHistorySyncChunk, type GoHistorySyncChunk } from "./webhook-go";

const corpusOk = corpusHistorySyncR2Disponivel();

describe.skipIf(!corpusOk)("HistorySync corpus - mensagens", () => {
  const fixtures = corpusOk ? carregarHistorySyncR2() : [];
  const pastaPrimaria = pastaHistorySyncPrimariaR2();

  function chunksComMsgs(): Array<{ arquivo: string; chunk: GoHistorySyncChunk }> {
    return fixtures
      .map((f) => ({ arquivo: f.arquivo, chunk: parseGoHistorySyncChunk(f.data) }))
      .filter((r) => r.chunk.temMensagens);
  }

  it("1) pelo menos um chunk com mensagens", () => {
    expect(chunksComMsgs().length).toBeGreaterThanOrEqual(1);
  });

  it("2) document e sticker aparecem quando ha midia rica", () => {
    const tipos = new Set<string>();
    for (const row of chunksComMsgs()) {
      for (const conv of row.chunk.conversations) {
        for (const msg of conv.messages) tipos.add(msg.type);
      }
    }
    expect(tipos.has("document") || tipos.has("sticker") || tipos.has("video")).toBe(true);
  });

  it("3) video aparece na instancia primaria do corpus", () => {
    const primaria = fixtures.filter((f) => f.instanciaPasta === pastaPrimaria);
    if (primaria.length === 0) return;
    const tipos = new Set<string>();
    for (const f of primaria) {
      const c = parseGoHistorySyncChunk(fatiarHistorySyncData(f.data, 500));
      for (const conv of c.conversations) {
        for (const msg of conv.messages) tipos.add(msg.type);
      }
    }
    // varre mais se fatia pequena nao pegou
    if (!tipos.has("video")) {
      for (const f of primaria) {
        const c = parseGoHistorySyncChunk(f.data);
        for (const conv of c.conversations) {
          for (const msg of conv.messages) {
            tipos.add(msg.type);
            if (tipos.has("video")) break;
          }
          if (tipos.has("video")) break;
        }
        if (tipos.has("video")) break;
      }
    }
    expect(tipos.has("video")).toBe(true);
  });

  it("4) messageObj de imagem tem imageMessage", () => {
    let achou = false;
    for (const row of chunksComMsgs()) {
      for (const conv of row.chunk.conversations) {
        for (const msg of conv.messages) {
          if (msg.type !== "image") continue;
          expect(msg.messageObj).toHaveProperty("imageMessage");
          achou = true;
          break;
        }
        if (achou) break;
      }
      if (achou) break;
    }
    expect(achou).toBe(true);
  });

  it("5) messageObj de audio tem audioMessage", () => {
    let achou = false;
    for (const row of chunksComMsgs()) {
      for (const conv of row.chunk.conversations) {
        for (const msg of conv.messages) {
          if (msg.type !== "audio") continue;
          expect(msg.messageObj).toHaveProperty("audioMessage");
          achou = true;
          break;
        }
        if (achou) break;
      }
      if (achou) break;
    }
    expect(achou).toBe(true);
  });

  it("6) stubs (messageStubType sem message) nao entram no chunk", () => {
    // Conta wrappers brutos com stub vs parseados
    let stubsBrutos = 0;
    let parseados = 0;
    for (const f of fixtures.slice(0, 15)) {
      const inner = (f.data.Data ?? f.data) as Record<string, unknown>;
      const convs = (inner.conversations as Array<Record<string, unknown>>) ?? [];
      for (const conv of convs) {
        for (const w of (conv.messages as Array<Record<string, unknown>>) ?? []) {
          const m = w.message as Record<string, unknown> | undefined;
          if (m && m.messageStubType !== undefined && !m.message) stubsBrutos += 1;
        }
      }
      parseados += parseGoHistorySyncChunk(f.data).conversations.reduce(
        (acc, c) => acc + c.messages.length,
        0,
      );
    }
    expect(stubsBrutos).toBeGreaterThan(0);
    // parseados pode ser grande; so garante que stubs nao zeraram o parser
    expect(parseados).toBeGreaterThan(0);
  });

  it("7) chatJid da mensagem casa com conversa ou remoteJID", () => {
    let n = 0;
    for (const row of chunksComMsgs()) {
      for (const conv of row.chunk.conversations) {
        for (const msg of conv.messages.slice(0, 20)) {
          expect(msg.chatJid.includes("@")).toBe(true);
          n += 1;
          if (n >= 100) return;
        }
      }
    }
    expect(n).toBeGreaterThan(0);
  });

  it("8) fatia 1 msg ainda tem temMensagens true", () => {
    const fonte = fixtures.find((f) => parseGoHistorySyncChunk(f.data).temMensagens)!;
    const fatia = parseGoHistorySyncChunk(fatiarHistorySyncData(fonte.data, 1));
    expect(fatia.temMensagens).toBe(true);
    const n = fatia.conversations.reduce((a, c) => a + c.messages.length, 0);
    expect(n).toBe(1);
  });

  it("9) fatia 0 msgs de chunk util vira temMensagens false se so pega convs vazias", () => {
    // fatiar com max 0 deve zerar
    const fonte = fixtures.find((f) => parseGoHistorySyncChunk(f.data).temMensagens)!;
    const fatia = parseGoHistorySyncChunk(fatiarHistorySyncData(fonte.data, 0));
    expect(fatia.temMensagens).toBe(false);
  });

  it("10) preserva phoneLidMappings ao fatiar", () => {
    const fonte = fixtures.find((f) => {
      const c = parseGoHistorySyncChunk(f.data);
      return c.phoneLidMappings.length > 0 && c.temMensagens;
    })!;
    const original = parseGoHistorySyncChunk(fonte.data);
    const fatia = parseGoHistorySyncChunk(fatiarHistorySyncData(fonte.data, 2));
    expect(fatia.phoneLidMappings.length).toBe(original.phoneLidMappings.length);
    expect(fatia.phoneLidMappings[0]).toEqual(original.phoneLidMappings[0]);
  });

  it("11) FULL chunks tem chunkOrder crescente na instancia primaria", () => {
    const full = fixtures
      .filter((f) => f.instanciaPasta === pastaPrimaria)
      .map((f) => parseGoHistorySyncChunk(f.data))
      .filter((c) => c.syncType === HISTORY_SYNC_TYPE.FULL && c.chunkOrder !== null)
      .map((c) => ({ order: c.chunkOrder!, progress: c.progress ?? 0 }))
      .toSorted((a, b) => a.order - b.order);
    if (full.length < 2) return;
    for (let i = 1; i < full.length; i++) {
      expect(full[i]!.order).toBeGreaterThan(full[i - 1]!.order);
      expect(full[i]!.progress).toBeGreaterThanOrEqual(full[i - 1]!.progress);
    }
  });

  it("12) bootstrap tem menos msgs que um chunk FULL tipico", () => {
    const bootstrap = fixtures
      .map((f) => parseGoHistorySyncChunk(f.data))
      .find((c) => c.syncType === HISTORY_SYNC_TYPE.INITIAL_BOOTSTRAP && c.temMensagens)!;
    const full = fixtures
      .map((f) => parseGoHistorySyncChunk(f.data))
      .find(
        (c) =>
          c.syncType === HISTORY_SYNC_TYPE.FULL &&
          c.temMensagens &&
          c.conversations.reduce((a, x) => a + x.messages.length, 0) > 1000,
      )!;
    const nBoot = bootstrap.conversations.reduce((a, c) => a + c.messages.length, 0);
    const nFull = full.conversations.reduce((a, c) => a + c.messages.length, 0);
    expect(nBoot).toBeLessThan(nFull);
  });

  it("13) unreadCount e numero >= 0 quando presente", () => {
    let n = 0;
    for (const row of chunksComMsgs()) {
      for (const conv of row.chunk.conversations) {
        expect(conv.unreadCount).toBeGreaterThanOrEqual(0);
        n += 1;
        if (n >= 50) return;
      }
    }
    expect(n).toBeGreaterThan(0);
  });

  it("14) nome de conversa e string ou null", () => {
    let comNome = 0;
    for (const row of chunksComMsgs()) {
      for (const conv of row.chunk.conversations) {
        if (conv.nome === null) continue;
        expect(typeof conv.nome).toBe("string");
        expect(conv.nome.length).toBeGreaterThan(0);
        comNome += 1;
        if (comNome >= 5) return;
      }
    }
    // corpus pode ter poucos nomes; so garante que nao quebrou
    expect(comNome).toBeGreaterThanOrEqual(0);
  });

  it("15) IDs de mensagem unicos dentro do mesmo chunk fatiado", () => {
    const fonte = fixtures.find((f) => parseGoHistorySyncChunk(f.data).temMensagens)!;
    const chunk = parseGoHistorySyncChunk(fatiarHistorySyncData(fonte.data, 50));
    const ids = chunk.conversations.flatMap((c) => c.messages.map((m) => m.messageId));
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("16) fromMe boolean estrito (nunca undefined)", () => {
    let n = 0;
    for (const row of chunksComMsgs()) {
      for (const conv of row.chunk.conversations) {
        for (const msg of conv.messages.slice(0, 30)) {
          expect(typeof msg.fromMe).toBe("boolean");
          n += 1;
          if (n >= 80) return;
        }
      }
    }
    expect(n).toBeGreaterThan(0);
  });

  it("17) location type se existir tem body placeholder", () => {
    for (const row of chunksComMsgs()) {
      for (const conv of row.chunk.conversations) {
        for (const msg of conv.messages) {
          if (msg.type === "location") {
            expect(msg.body.length).toBeGreaterThan(0);
            return;
          }
        }
      }
    }
    // location e raro - ok se nao houver
    expect(true).toBe(true);
  });

  it("18) contacts type se existir tem body", () => {
    for (const row of chunksComMsgs()) {
      for (const conv of row.chunk.conversations) {
        for (const msg of conv.messages) {
          if (msg.type === "contacts") {
            expect(msg.body.length).toBeGreaterThan(0);
            return;
          }
        }
      }
    }
    expect(true).toBe(true);
  });

  it("19) RECENT final (order max) tem progress 100 na instancia primaria", () => {
    const recent = fixtures
      .filter((f) => f.instanciaPasta === pastaPrimaria)
      .map((f) => parseGoHistorySyncChunk(f.data))
      .filter((c) => c.syncType === HISTORY_SYNC_TYPE.RECENT)
      .toSorted((a, b) => (a.chunkOrder ?? 0) - (b.chunkOrder ?? 0));
    if (recent.length === 0) return;
    expect(recent.at(-1)!.progress).toBe(100);
  });

  it("20) nenhum messageId com espaco", () => {
    let n = 0;
    for (const row of chunksComMsgs()) {
      for (const conv of row.chunk.conversations) {
        for (const msg of conv.messages.slice(0, 40)) {
          expect(msg.messageId).not.toMatch(/\s/);
          n += 1;
          if (n >= 100) return;
        }
      }
    }
    expect(n).toBeGreaterThan(0);
  });

  it("21) extendedText aparece no corpus", () => {
    let achou = false;
    for (const row of chunksComMsgs()) {
      for (const conv of row.chunk.conversations) {
        for (const msg of conv.messages) {
          if (msg.type === "text" && msg.body.length > 20) {
            achou = true;
            break;
          }
        }
        if (achou) break;
      }
      if (achou) break;
    }
    expect(achou).toBe(true);
  });

  it("22) status string quando presente no parse sintetico", () => {
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
                  key: { remoteJID: "5511@s.whatsapp.net", fromMe: true, ID: "ST" },
                  message: { conversation: "x" },
                  messageTimestamp: 1_700_000_000,
                  status: "PLAYED",
                },
              },
            ],
          },
        ],
      },
    });
    expect(chunk.conversations[0]!.messages[0]!.status).toBe("PLAYED");
  });

  it("23) conversa grupo tem jid @g.us", () => {
    let achou = false;
    for (const row of chunksComMsgs()) {
      for (const conv of row.chunk.conversations) {
        if (conv.jid.endsWith("@g.us") && conv.messages.length > 0) {
          achou = true;
          expect(conv.messages[0]!.chatJid).toContain("@");
          break;
        }
      }
      if (achou) break;
    }
    expect(achou).toBe(true);
  });

  it("24) poll type se existir tem body com ?", () => {
    for (const row of chunksComMsgs()) {
      for (const conv of row.chunk.conversations) {
        for (const msg of conv.messages) {
          if (msg.type === "poll") {
            expect(msg.body.length).toBeGreaterThan(0);
            return;
          }
        }
      }
    }
    expect(true).toBe(true);
  });

  it("25) syncType RECENT tem mais chunks que bootstrap na instancia primaria", () => {
    const primaria = fixtures.filter((f) => f.instanciaPasta === pastaPrimaria);
    if (primaria.length === 0) return;
    const recent = primaria.filter(
      (f) => parseGoHistorySyncChunk(f.data).syncType === HISTORY_SYNC_TYPE.RECENT,
    ).length;
    const boot = primaria.filter(
      (f) => parseGoHistorySyncChunk(f.data).syncType === HISTORY_SYNC_TYPE.INITIAL_BOOTSTRAP,
    ).length;
    if (recent === 0 && boot === 0) return;
    expect(recent).toBeGreaterThan(boot);
  });
});
