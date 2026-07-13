/**
 * Fixtures JSON locais (sem r2-sync) — cobertura offline do parser HistorySync.
 */
import { describe, expect, it } from "vitest";

import {
  buscarFixtureWebhookGo,
  carregarFixturesWebhookGo,
} from "./fixtures/carregar-fixtures-webhook-go";
import {
  deveIgnorarHistorySyncChunk,
  HISTORY_SYNC_TYPE,
  historySyncConcluido,
  mapaLidParaPn,
  parseGoHistorySyncChunk,
  resolverJidHistoricoSync,
  rotuloHistorySyncType,
} from "./webhook-go";

function dataDoFixture(nome: string): Record<string, unknown> {
  const f = buscarFixtureWebhookGo(nome);
  if (!f) throw new Error(`fixture ausente: ${nome}`);
  return f.payload.data as Record<string, unknown>;
}

describe("HistorySync fixtures estaticos (offline)", () => {
  it("1) todas as fixtures history-sync-* parseiam sem throw", () => {
    const arquivos = carregarFixturesWebhookGo()
      .filter((f) => f.arquivo.startsWith("history-sync-"))
      .map((f) => f.arquivo);
    expect(arquivos.length).toBeGreaterThanOrEqual(5);
    for (const nome of arquivos) {
      const chunk = parseGoHistorySyncChunk(dataDoFixture(nome));
      expect(chunk.syncType, nome).toBeGreaterThanOrEqual(0);
      expect(typeof chunk.temMensagens, nome).toBe("boolean");
    }
  });

  it("2) metadata-only e ignorada", () => {
    const chunk = parseGoHistorySyncChunk(dataDoFixture("history-sync-metadata-only.json"));
    expect(chunk.syncType).toBe(HISTORY_SYNC_TYPE.NON_BLOCKING_DATA);
    expect(deveIgnorarHistorySyncChunk(chunk)).toBe(true);
    expect(chunk.conversations).toHaveLength(0);
  });

  it("3) bootstrap-mini: 2 msgs, fase 0 @ 100 nao conclui conta", () => {
    const chunk = parseGoHistorySyncChunk(dataDoFixture("history-sync-bootstrap-mini.json"));
    expect(chunk.syncType).toBe(HISTORY_SYNC_TYPE.INITIAL_BOOTSTRAP);
    expect(chunk.progress).toBe(100);
    expect(chunk.conversations[0]?.messages).toHaveLength(2);
    expect(historySyncConcluido(chunk)).toBe(false);
    expect(deveIgnorarHistorySyncChunk(chunk)).toBe(false);
  });

  it("4) recent-complete: RECENT @ 100 conclui + extendedText", () => {
    const chunk = parseGoHistorySyncChunk(dataDoFixture("history-sync-recent-complete.json"));
    expect(chunk.syncType).toBe(HISTORY_SYNC_TYPE.RECENT);
    expect(chunk.progress).toBe(100);
    expect(historySyncConcluido(chunk)).toBe(true);
    const msgs = chunk.conversations.flatMap((c) => c.messages);
    expect(msgs.length).toBeGreaterThanOrEqual(2);
    expect(msgs.some((m) => m.type === "text" && m.body.includes("Confirmar"))).toBe(true);
    expect(msgs.some((m) => m.body.includes("TIAGO"))).toBe(true);
  });

  it("5) recent-complete: status numerico vira string WMI", () => {
    const chunk = parseGoHistorySyncChunk(dataDoFixture("history-sync-recent-complete.json"));
    for (const msg of chunk.conversations.flatMap((c) => c.messages)) {
      expect(msg.status).toBe("READ");
    }
  });

  it("6) recent-complete: phoneNumberToLidMappings parseados", () => {
    const chunk = parseGoHistorySyncChunk(dataDoFixture("history-sync-recent-complete.json"));
    expect(chunk.phoneLidMappings.length).toBeGreaterThanOrEqual(3);
    expect(chunk.phoneLidMappings[0]?.pnJid).toContain("@s.whatsapp.net");
    expect(chunk.phoneLidMappings[0]?.lidJid).toContain("@lid");
  });

  it("7) lid-map resolve PN canonico", () => {
    const chunk = parseGoHistorySyncChunk(dataDoFixture("history-sync-lid-map.json"));
    expect(chunk.phoneLidMappings.length).toBeGreaterThan(0);
    const { lidJid, pnJid } = chunk.phoneLidMappings[0]!;
    const mapa = mapaLidParaPn(chunk.phoneLidMappings);
    const resolved = resolverJidHistoricoSync(lidJid, mapa);
    expect(resolved.idExternoCanonico).toBe(pnJid);
    expect(resolved.idExternoLinha).toBe(lidJid);
  });

  it("8) group: conversa @g.us com nome e mix inbound/outbound", () => {
    const chunk = parseGoHistorySyncChunk(dataDoFixture("history-sync-group.json"));
    expect(chunk.syncType).toBe(HISTORY_SYNC_TYPE.INITIAL_BOOTSTRAP);
    const grupo = chunk.conversations[0]!;
    expect(grupo.jid).toMatch(/@g\.us$/);
    expect(grupo.nome).toContain("Clínica Work");
    expect(grupo.messages).toHaveLength(2);
    expect(grupo.messages.some((m) => m.fromMe)).toBe(true);
    expect(grupo.messages.some((m) => !m.fromMe)).toBe(true);
  });

  it("9) group: msg inbound tem body parseado", () => {
    const chunk = parseGoHistorySyncChunk(dataDoFixture("history-sync-group.json"));
    const inbound = chunk.conversations[0]!.messages.find((m) => !m.fromMe)!;
    expect(inbound.body).toContain("sexta");
    expect(inbound.type).toBe("text");
  });

  it("10) rotuloHistorySyncType bate com syncType das fixtures", () => {
    const casos: Array<[string, string]> = [
      ["history-sync-metadata-only.json", "metadata"],
      ["history-sync-bootstrap-mini.json", "bootstrap"],
      ["history-sync-recent-complete.json", "recente"],
      ["history-sync-group.json", "bootstrap"],
    ];
    for (const [arquivo, rotulo] of casos) {
      const chunk = parseGoHistorySyncChunk(dataDoFixture(arquivo));
      expect(rotuloHistorySyncType(chunk.syncType), arquivo).toBe(rotulo);
    }
  });

  it("11) timestamps das fixtures sao Date validos", () => {
    for (const nome of [
      "history-sync-bootstrap-mini.json",
      "history-sync-recent-complete.json",
      "history-sync-group.json",
    ]) {
      const chunk = parseGoHistorySyncChunk(dataDoFixture(nome));
      for (const msg of chunk.conversations.flatMap((c) => c.messages)) {
        expect(msg.timestamp, nome).toBeInstanceOf(Date);
        expect(Number.isNaN(msg.timestamp!.getTime()), nome).toBe(false);
      }
    }
  });

  it("12) chunkOrder preservado quando presente", () => {
    const chunk = parseGoHistorySyncChunk(dataDoFixture("history-sync-recent-complete.json"));
    expect(chunk.chunkOrder).toBe(2);
  });
});
