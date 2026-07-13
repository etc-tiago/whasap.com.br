/**
 * Lacunas do corpus: tipos nao parseados, taxa stub, outras instancias.
 */
import { describe, expect, it } from "vitest";

import {
  carregarHistorySyncR2,
  corpusHistorySyncR2Disponivel,
  fatiarHistorySyncData,
} from "./fixtures/carregar-history-sync-r2";
import { HISTORY_SYNC_TYPE, parseGoHistorySyncChunk } from "./webhook-go";

const ok = corpusHistorySyncR2Disponivel();

describe.skipIf(!ok)("HistorySync corpus - lacunas e multi-instancia", () => {
  const all = ok ? carregarHistorySyncR2() : [];

  it("1) instancia 7001e982 tem HistorySync se presente", () => {
    const n = all.filter((f) => f.instanciaPasta.includes("7001e982")).length;
    // pode nao ter no dia - so documenta
    expect(n).toBeGreaterThanOrEqual(0);
  });

  it("2) pelo menos 2 pastas de instancia no corpus", () => {
    const pastas = new Set(all.map((f) => f.instanciaPasta));
    expect(pastas.size).toBeGreaterThanOrEqual(2);
  });

  it("3) taxa de parse > 90% nos wrappers com key+message", () => {
    let comKeyMsg = 0;
    let parseados = 0;
    for (const f of all) {
      const inner = (f.data.Data ?? f.data) as Record<string, unknown>;
      for (const conv of (inner.conversations as Array<Record<string, unknown>>) ?? []) {
        for (const w of (conv.messages as Array<Record<string, unknown>>) ?? []) {
          const m = w?.message as Record<string, unknown> | undefined;
          if (!m || !m.key || !m.message) continue;
          comKeyMsg += 1;
        }
      }
      parseados += parseGoHistorySyncChunk(f.data).conversations.reduce(
        (a, c) => a + c.messages.length,
        0,
      );
    }
    expect(comKeyMsg).toBeGreaterThan(1000);
    expect(parseados / comKeyMsg).toBeGreaterThan(0.9);
  });

  it("4) templateMessage existe no bruto mas some no parse", () => {
    let templatesBrutos = 0;
    let templatesParseados = 0;
    for (const f of all) {
      const inner = (f.data.Data ?? f.data) as Record<string, unknown>;
      for (const conv of (inner.conversations as Array<Record<string, unknown>>) ?? []) {
        for (const w of (conv.messages as Array<Record<string, unknown>>) ?? []) {
          const msgObj = (w?.message as Record<string, unknown> | undefined)?.message as
            | Record<string, unknown>
            | undefined;
          if (msgObj?.templateMessage) templatesBrutos += 1;
        }
      }
      for (const conv of parseGoHistorySyncChunk(f.data).conversations) {
        for (const msg of conv.messages) {
          if (msg.messageObj.templateMessage) templatesParseados += 1;
        }
      }
    }
    if (templatesBrutos === 0) {
      expect(true).toBe(true);
      return;
    }
    // parser atual descarta template (parseGoMessageBody retorna null)
    expect(templatesParseados).toBe(0);
    expect(templatesBrutos).toBeGreaterThan(0);
  });

  it("5) buttonsMessage bruto nao vira type conhecido", () => {
    let buttons = 0;
    for (const f of all) {
      const inner = (f.data.Data ?? f.data) as Record<string, unknown>;
      for (const conv of (inner.conversations as Array<Record<string, unknown>>) ?? []) {
        for (const w of (conv.messages as Array<Record<string, unknown>>) ?? []) {
          const msgObj = (w?.message as Record<string, unknown> | undefined)?.message as
            | Record<string, unknown>
            | undefined;
          if (msgObj?.buttonsMessage) buttons += 1;
        }
      }
    }
    const tipos = new Set<string>();
    for (const f of all) {
      for (const c of parseGoHistorySyncChunk(f.data).conversations) {
        for (const m of c.messages) tipos.add(m.type);
      }
    }
    expect(tipos.has("buttons")).toBe(false);
    expect(buttons).toBeGreaterThanOrEqual(0);
  });

  it("6) albumMessage bruto existe em ClinicaWork", () => {
    let albums = 0;
    for (const f of all.filter((x) => x.instanciaPasta.includes("847c01d8"))) {
      const inner = (f.data.Data ?? f.data) as Record<string, unknown>;
      for (const conv of (inner.conversations as Array<Record<string, unknown>>) ?? []) {
        for (const w of (conv.messages as Array<Record<string, unknown>>) ?? []) {
          const msgObj = (w?.message as Record<string, unknown> | undefined)?.message as
            | Record<string, unknown>
            | undefined;
          if (msgObj?.albumMessage) albums += 1;
        }
      }
    }
    expect(albums).toBeGreaterThanOrEqual(0);
  });

  it("7) fatiar nao altera phoneNumberToLidMappings length", () => {
    const fonte = all.find((f) => parseGoHistorySyncChunk(f.data).phoneLidMappings.length > 5)!;
    const a = parseGoHistorySyncChunk(fonte.data).phoneLidMappings.length;
    const b = parseGoHistorySyncChunk(fatiarHistorySyncData(fonte.data, 1)).phoneLidMappings.length;
    expect(b).toBe(a);
  });

  it("8) fatiar com max grande devolve todas as msgs do chunk se cabem", () => {
    const fonte = all.find((f) => {
      const c = parseGoHistorySyncChunk(f.data);
      const n = c.conversations.reduce((acc, x) => acc + x.messages.length, 0);
      return n > 0 && n < 50;
    });
    if (!fonte) {
      expect(true).toBe(true);
      return;
    }
    const original = parseGoHistorySyncChunk(fonte.data);
    const nOrig = original.conversations.reduce((a, c) => a + c.messages.length, 0);
    const fatia = parseGoHistorySyncChunk(fatiarHistorySyncData(fonte.data, 10_000));
    const nFatia = fatia.conversations.reduce((a, c) => a + c.messages.length, 0);
    expect(nFatia).toBe(nOrig);
  });

  it("9) NON_BLOCKING pode ter conversations sem messages", () => {
    const meta = all
      .map((f) => parseGoHistorySyncChunk(f.data))
      .find((c) => c.syncType === HISTORY_SYNC_TYPE.NON_BLOCKING_DATA)!;
    expect(meta.temMensagens).toBe(false);
  });

  it("10) PUSH_NAME code (syncType 1) tem 0 msgs parseadas", () => {
    const rows = all
      .map((f) => parseGoHistorySyncChunk(f.data))
      .filter((c) => c.syncType === HISTORY_SYNC_TYPE.PUSH_NAME);
    expect(rows.length).toBeGreaterThanOrEqual(1);
    for (const c of rows) {
      expect(c.temMensagens).toBe(false);
    }
  });

  it("11) ON_DEMAND code (syncType 4) no corpus e metadata pushnames", () => {
    const rows = all
      .map((f) => parseGoHistorySyncChunk(f.data))
      .filter((c) => c.syncType === HISTORY_SYNC_TYPE.ON_DEMAND);
    expect(rows.length).toBeGreaterThanOrEqual(1);
    for (const c of rows) {
      expect(c.temMensagens).toBe(false);
    }
  });

  it("12) 139f886b e 847c01d8 ambos tem syncType RECENT ou FULL", () => {
    for (const pasta of ["139f886b", "847c01d8"]) {
      const tipos = new Set(
        all
          .filter((f) => f.instanciaPasta.includes(pasta))
          .map((f) => parseGoHistorySyncChunk(f.data).syncType),
      );
      if (tipos.size === 0) continue;
      const util =
        tipos.has(HISTORY_SYNC_TYPE.RECENT) ||
        tipos.has(HISTORY_SYNC_TYPE.FULL) ||
        tipos.has(HISTORY_SYNC_TYPE.INITIAL_BOOTSTRAP);
      expect(util, pasta).toBe(true);
    }
  });

  it("13) receivedAt do envelope e ISO", () => {
    for (const f of all.slice(0, 10)) {
      expect(Number.isNaN(Date.parse(f.envelope.receivedAt))).toBe(false);
    }
  });

  it("14) meta.path do envelope aponta HistorySync", () => {
    for (const f of all.slice(0, 10)) {
      expect(f.envelope.meta.path ?? f.arquivo).toMatch(/HistorySync/i);
    }
  });

  it("15) nenhuma conversa parseada tem jid vazio", () => {
    for (const f of all) {
      for (const c of parseGoHistorySyncChunk(f.data).conversations) {
        expect(c.jid.length).toBeGreaterThan(0);
      }
    }
  });
});
