/**
 * Regressao do bug que derrubou o HistorySync da ClinicaWork:
 * Date.toString() no SQL de ultima_mensagem_em.
 */
import { describe, expect, it } from "vitest";

import { isoTimestampParaSql } from "./ingestao-mensagem";
import {
  deveIgnorarHistorySyncChunk,
  HISTORY_SYNC_TYPE,
  historySyncConcluido,
  parseGoHistorySyncChunk,
} from "@whasap/evolution";
import {
  carregarHistorySyncR2,
  corpusHistorySyncR2Disponivel,
  fatiarHistorySyncData,
  pastaHistorySyncPrimariaR2,
} from "../../../evolution/src/fixtures/carregar-history-sync-r2";
import { buscarFixtureWebhookGo } from "../../../evolution/src/fixtures/carregar-fixtures-webhook-go";

describe("isoTimestampParaSql (regressao HistorySync)", () => {
  it("1) Date historico vira ISO, nao Wed Sep 18", () => {
    const d = new Date("2024-09-18T14:27:40.000Z");
    const iso = isoTimestampParaSql(d);
    expect(iso).toBe("2024-09-18T14:27:40.000Z");
    expect(iso).not.toContain("Wed");
    expect(iso).not.toContain("GMT");
  });

  it("2) Date.now() tambem e ISO com Z", () => {
    const iso = isoTimestampParaSql(new Date("2026-07-13T13:08:47.159Z"));
    expect(iso).toBe("2026-07-13T13:08:47.159Z");
  });

  it("3) Invalid Date faz fallback para ISO valido", () => {
    const iso = isoTimestampParaSql(new Date(Number.NaN));
    expect(Number.isNaN(Date.parse(iso))).toBe(false);
    expect(iso).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it("4) nunca retorna o formato que o Postgres rejeitou no erro de producao", () => {
    const d = new Date("Wed Sep 18 2024 14:27:40 GMT+0000");
    const iso = isoTimestampParaSql(d);
    expect(iso.startsWith("2024-09-18T")).toBe(true);
    expect(d.toString()).toContain("Wed");
    expect(iso).not.toEqual(d.toString());
  });

  it("4b) epoch 0 vira ISO 1970 (ainda aceito pelo Postgres)", () => {
    const iso = isoTimestampParaSql(new Date(0));
    expect(iso).toBe("1970-01-01T00:00:00.000Z");
  });

  it("4c) Date com offset local ainda serializa em Z", () => {
    const iso = isoTimestampParaSql(new Date("2024-09-18T11:27:40-03:00"));
    expect(iso).toBe("2024-09-18T14:27:40.000Z");
  });

  it("4d) milissegundos preservados", () => {
    expect(isoTimestampParaSql(new Date("2024-01-01T00:00:00.123Z"))).toBe(
      "2024-01-01T00:00:00.123Z",
    );
  });

  it("4e) duas Dates iguais geram mesma string (deterministico)", () => {
    const d = new Date("2024-09-18T14:27:40.000Z");
    expect(isoTimestampParaSql(d)).toBe(isoTimestampParaSql(d));
  });
});

describe("fixtures estaticos — timestamps seguros (offline)", () => {
  it("13) recent-complete: todos timestamps viram ISO SQL-safe", () => {
    const fix = buscarFixtureWebhookGo("history-sync-recent-complete.json");
    expect(fix).toBeTruthy();
    const chunk = parseGoHistorySyncChunk(fix!.payload.data as Record<string, unknown>);
    for (const msg of chunk.conversations.flatMap((c) => c.messages)) {
      if (!msg.timestamp) continue;
      const iso = isoTimestampParaSql(msg.timestamp);
      expect(iso).not.toContain("Wed");
      expect(iso).toMatch(/Z$/);
    }
  });

  it("14) group fixture: epoch em segundos vira Date em ms", () => {
    const fix = buscarFixtureWebhookGo("history-sync-group.json");
    const chunk = parseGoHistorySyncChunk(fix!.payload.data as Record<string, unknown>);
    const ts = chunk.conversations[0]!.messages[0]!.timestamp!;
    expect(ts.getTime()).toBeGreaterThan(1_700_000_000_000);
  });
});

describe.skipIf(!corpusHistorySyncR2Disponivel())(
  "processarHistorySyncChunk - contrato via corpus",
  () => {
    const pastaPrimaria = pastaHistorySyncPrimariaR2();
    const fixtures = pastaPrimaria ? carregarHistorySyncR2({ instanciaPasta: pastaPrimaria }) : [];

    it("5) fatia RECENT preserva syncType/progress para conclusao", () => {
      const fix = fixtures.find((f) => {
        const c = parseGoHistorySyncChunk(f.data);
        return c.syncType === HISTORY_SYNC_TYPE.RECENT && c.progress === 100 && c.temMensagens;
      });
      if (!fix) return;
      const fatia = parseGoHistorySyncChunk(fatiarHistorySyncData(fix.data, 3));
      expect(fatia.syncType).toBe(HISTORY_SYNC_TYPE.RECENT);
      expect(fatia.progress).toBe(100);
      expect(historySyncConcluido(fatia)).toBe(true);
      expect(deveIgnorarHistorySyncChunk(fatia)).toBe(false);
    });

    it("6) fatia FULL@100 nao conclui", () => {
      const fix = fixtures.find((f) => {
        const c = parseGoHistorySyncChunk(f.data);
        return c.syncType === HISTORY_SYNC_TYPE.FULL && c.progress === 100 && c.temMensagens;
      });
      if (!fix) return;
      const fatia = parseGoHistorySyncChunk(fatiarHistorySyncData(fix.data, 3));
      expect(historySyncConcluido(fatia)).toBe(false);
    });

    it("7) timestamps do corpus viram ISO seguros para SQL", () => {
      const fix = fixtures.find((f) => parseGoHistorySyncChunk(f.data).temMensagens);
      if (!fix) return;
      const chunk = parseGoHistorySyncChunk(fatiarHistorySyncData(fix.data, 20));
      for (const conv of chunk.conversations) {
        for (const msg of conv.messages) {
          if (!msg.timestamp) continue;
          const iso = isoTimestampParaSql(msg.timestamp);
          expect(iso).not.toContain("Wed");
          expect(iso).toMatch(/^\d{4}-\d{2}-\d{2}T.*Z$/);
        }
      }
    });

    it("9) expandido: fatias 1/5/10 preservam syncType do FULL", () => {
      const fix = fixtures.find((f) => {
        const c = parseGoHistorySyncChunk(f.data);
        return c.syncType === HISTORY_SYNC_TYPE.FULL && c.temMensagens;
      });
      if (!fix) return;
      for (const n of [1, 5, 10]) {
        const fatia = parseGoHistorySyncChunk(fatiarHistorySyncData(fix.data, n));
        expect(fatia.syncType).toBe(HISTORY_SYNC_TYPE.FULL);
      }
    });

    it("10) expandido: bootstrap ISO timestamps tambem seguros", () => {
      const fix = fixtures.find((f) => {
        const c = parseGoHistorySyncChunk(f.data);
        return c.syncType === HISTORY_SYNC_TYPE.INITIAL_BOOTSTRAP && c.temMensagens;
      });
      if (!fix) return;
      const chunk = parseGoHistorySyncChunk(fatiarHistorySyncData(fix.data, 15));
      for (const conv of chunk.conversations) {
        for (const msg of conv.messages) {
          if (!msg.timestamp) continue;
          expect(isoTimestampParaSql(msg.timestamp)).toMatch(/Z$/);
        }
      }
    });

    it("11) expandido: RECENT parcial nao conclui apos fatiar", () => {
      const fix = fixtures.find((f) => {
        const c = parseGoHistorySyncChunk(f.data);
        return (
          c.syncType === HISTORY_SYNC_TYPE.RECENT &&
          c.progress !== null &&
          c.progress < 100 &&
          c.temMensagens
        );
      });
      if (!fix) return;
      const fatia = parseGoHistorySyncChunk(fatiarHistorySyncData(fix.data, 4));
      expect(historySyncConcluido(fatia)).toBe(false);
    });

    it("12) expandido: epoch em segundos do corpus vira Date < agora+1dia", () => {
      const fix = fixtures.find((f) => parseGoHistorySyncChunk(f.data).temMensagens);
      if (!fix) return;
      const chunk = parseGoHistorySyncChunk(fatiarHistorySyncData(fix.data, 10));
      const limite = Date.now() + 24 * 60 * 60 * 1000;
      for (const conv of chunk.conversations) {
        for (const msg of conv.messages) {
          if (!msg.timestamp) continue;
          expect(msg.timestamp.getTime()).toBeLessThan(limite);
          expect(msg.timestamp.getTime()).toBeGreaterThan(1_000_000_000_000); // ms since 2001-ish via *1000
        }
      }
    });
  },
);
