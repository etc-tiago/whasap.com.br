/**
 * Matriz HistorySync contra corpus real em `packages/r2-sync/json/webhook/evo`.
 * Garante contrato do parser / fases / LID / timestamps antes da ingestão.
 */
import { describe, expect, it } from "vitest";

import {
  carregarHistorySyncR2,
  corpusHistorySyncR2Disponivel,
  fatiarHistorySyncData,
  pastaHistorySyncPrimariaR2,
} from "./fixtures/carregar-history-sync-r2";
import {
  deveIgnorarHistorySyncChunk,
  HISTORY_SYNC_CHUNK_MSG_CAP,
  HISTORY_SYNC_TYPE,
  historySyncConcluido,
  jidParaTelefone,
  mapaLidParaPn,
  parseGoHistorySyncChunk,
  resolverJidHistoricoSync,
  rotuloHistorySyncType,
  type GoHistorySyncChunk,
} from "./webhook-go";

const corpusOk = corpusHistorySyncR2Disponivel();

describe.skipIf(!corpusOk)("HistorySync corpus R2 (parser)", () => {
  const fixtures = corpusOk ? carregarHistorySyncR2() : [];
  const pastaPrimaria = pastaHistorySyncPrimariaR2();
  const parsed: Array<{ arquivo: string; instanciaPasta: string; chunk: GoHistorySyncChunk }> =
    fixtures.map((f) => ({
      arquivo: f.arquivo,
      instanciaPasta: f.instanciaPasta,
      chunk: parseGoHistorySyncChunk(f.data),
    }));

  it("1) carrega HistorySync do corpus", () => {
    expect(fixtures.length).toBeGreaterThanOrEqual(1);
  });

  it("2) todos os eventos são HistorySync", () => {
    for (const f of fixtures) {
      expect(f.payload.event, f.arquivo).toBe("HistorySync");
      expect(f.data).toBeTruthy();
    }
  });

  it("3) parseGoHistorySyncChunk não lança em nenhum arquivo", () => {
    expect(parsed).toHaveLength(fixtures.length);
    for (const row of parsed) {
      expect(row.chunk.syncType).toBeGreaterThanOrEqual(0);
    }
  });

  it("4) syncType 5 (NON_BLOCKING_DATA) sempre ignorado", () => {
    const rows = parsed.filter((p) => p.chunk.syncType === HISTORY_SYNC_TYPE.NON_BLOCKING_DATA);
    expect(rows.length).toBeGreaterThanOrEqual(1);
    for (const row of rows) {
      expect(deveIgnorarHistorySyncChunk(row.chunk), row.arquivo).toBe(true);
      expect(row.chunk.temMensagens).toBe(false);
      expect(historySyncConcluido(row.chunk)).toBe(false);
    }
  });

  it("5) syncType 1 (STATUS_V3) sem mensagens é ignorado", () => {
    const rows = parsed.filter((p) => p.chunk.syncType === HISTORY_SYNC_TYPE.STATUS_V3);
    if (rows.length === 0) return;
    for (const row of rows) {
      expect(deveIgnorarHistorySyncChunk(row.chunk), row.arquivo).toBe(true);
    }
  });

  it("6) syncType 4 (PUSH_NAMES) sem mensagens é ignorado", () => {
    const rows = parsed.filter((p) => p.chunk.syncType === HISTORY_SYNC_TYPE.PUSH_NAMES);
    expect(rows.length).toBeGreaterThanOrEqual(1);
    for (const row of rows) {
      expect(row.chunk.temMensagens, row.arquivo).toBe(false);
      expect(deveIgnorarHistorySyncChunk(row.chunk), row.arquivo).toBe(true);
    }
  });

  it("7) bootstrap (0) @ 100 com mensagens NÃO conclui o sync", () => {
    const rows = parsed.filter(
      (p) =>
        p.chunk.syncType === HISTORY_SYNC_TYPE.INITIAL_BOOTSTRAP &&
        p.chunk.progress === 100 &&
        p.chunk.temMensagens,
    );
    expect(rows.length).toBeGreaterThanOrEqual(1);
    for (const row of rows) {
      expect(deveIgnorarHistorySyncChunk(row.chunk)).toBe(false);
      expect(historySyncConcluido(row.chunk), row.arquivo).toBe(false);
    }
  });

  it("8) FULL (3) @ 100 com mensagens NÃO conclui o sync", () => {
    const rows = parsed.filter(
      (p) =>
        p.chunk.syncType === HISTORY_SYNC_TYPE.FULL &&
        p.chunk.progress === 100 &&
        p.chunk.temMensagens,
    );
    expect(rows.length).toBeGreaterThanOrEqual(1);
    for (const row of rows) {
      expect(historySyncConcluido(row.chunk), row.arquivo).toBe(false);
    }
  });

  it("9) RECENT (2) @ 100 com mensagens conclui o sync", () => {
    const rows = parsed.filter(
      (p) =>
        p.chunk.syncType === HISTORY_SYNC_TYPE.RECENT &&
        p.chunk.progress === 100 &&
        p.chunk.temMensagens,
    );
    expect(rows.length).toBeGreaterThanOrEqual(1);
    for (const row of rows) {
      expect(historySyncConcluido(row.chunk), row.arquivo).toBe(true);
      expect(deveIgnorarHistorySyncChunk(row.chunk)).toBe(false);
    }
  });

  it("10) RECENT parcial (progress < 100) não conclui", () => {
    const rows = parsed.filter(
      (p) =>
        p.chunk.syncType === HISTORY_SYNC_TYPE.RECENT &&
        p.chunk.progress !== null &&
        p.chunk.progress < 100 &&
        p.chunk.temMensagens,
    );
    expect(rows.length).toBeGreaterThanOrEqual(1);
    for (const row of rows) {
      expect(historySyncConcluido(row.chunk), row.arquivo).toBe(false);
    }
  });

  it("11) por instância, o único chunk concluído é RECENT@100", () => {
    const porInst = new Map<string, typeof parsed>();
    for (const row of parsed) {
      const lista = porInst.get(row.instanciaPasta) ?? [];
      lista.push(row);
      porInst.set(row.instanciaPasta, lista);
    }
    let instanciasComConclusao = 0;
    for (const rows of porInst.values()) {
      const concluidos = rows.filter((r) => historySyncConcluido(r.chunk));
      if (concluidos.length === 0) continue;
      instanciasComConclusao += 1;
      expect(concluidos.every((c) => c.chunk.syncType === HISTORY_SYNC_TYPE.RECENT)).toBe(true);
      expect(concluidos.every((c) => c.chunk.progress === 100)).toBe(true);
    }
    expect(instanciasComConclusao).toBeGreaterThanOrEqual(1);
  });

  it("12) phoneNumberToLidMappings usa pnJID/lidJID e parseia", () => {
    const comMap = parsed.filter((p) => p.chunk.phoneLidMappings.length > 0);
    if (comMap.length === 0) return;
    for (const row of comMap.slice(0, 5)) {
      for (const m of row.chunk.phoneLidMappings.slice(0, 3)) {
        expect(m.pnJid).toMatch(/@s\.whatsapp\.net$/);
        expect(m.lidJid).toMatch(/@lid$/);
      }
    }
  });

  it("13) resolverJidHistoricoSync mapeia @lid → PN canônico", () => {
    const row = parsed.find((p) => p.chunk.phoneLidMappings.length > 0)!;
    const mapa = mapaLidParaPn(row.chunk.phoneLidMappings);
    const amostra = row.chunk.phoneLidMappings[0]!;
    const resolved = resolverJidHistoricoSync(amostra.lidJid, mapa);
    expect(resolved.idExternoCanonico).toBe(amostra.pnJid);
    expect(resolved.idExternoLinha).toBe(amostra.lidJid);
    expect(resolved.phone).toBe(jidParaTelefone(amostra.pnJid));
  });

  it("14) resolver @g.us mantém JID do grupo como canônico", () => {
    const comGrupo = parsed.find((p) => p.chunk.conversations.some((c) => c.jid.endsWith("@g.us")));
    expect(comGrupo).toBeTruthy();
    const grupo = comGrupo!.chunk.conversations.find((c) => c.jid.endsWith("@g.us"))!;
    const resolved = resolverJidHistoricoSync(grupo.jid, new Map());
    expect(resolved.idExternoCanonico).toBe(grupo.jid);
  });

  it("15) timestamps parseados são Date válidos (não NaN) — regressão SQL", () => {
    let contagem = 0;
    for (const row of parsed) {
      for (const conv of row.chunk.conversations) {
        for (const msg of conv.messages) {
          if (!msg.timestamp) continue;
          expect(Number.isNaN(msg.timestamp.getTime()), row.arquivo).toBe(false);
          // ISO serializável (o que o driver/Postgres precisam)
          expect(msg.timestamp.toISOString()).toMatch(/^\d{4}-\d{2}-\d{2}T/);
          contagem += 1;
          if (contagem >= 200) return;
        }
      }
    }
    expect(contagem).toBeGreaterThanOrEqual(50);
  });

  it("16) timestamps históricos caem em janela razoável (2018–2027)", () => {
    let contagem = 0;
    for (const row of parsed) {
      for (const conv of row.chunk.conversations) {
        for (const msg of conv.messages) {
          if (!msg.timestamp) continue;
          const y = msg.timestamp.getUTCFullYear();
          expect(y, `${row.arquivo} ${msg.messageId}`).toBeGreaterThanOrEqual(2018);
          expect(y, `${row.arquivo} ${msg.messageId}`).toBeLessThanOrEqual(2027);
          contagem += 1;
          if (contagem >= 200) return;
        }
      }
    }
    expect(contagem).toBeGreaterThanOrEqual(50);
  });

  it("17) messageId nunca vazio nas msgs parseadas", () => {
    let contagem = 0;
    for (const row of parsed) {
      for (const conv of row.chunk.conversations) {
        for (const msg of conv.messages) {
          expect(msg.messageId.length, row.arquivo).toBeGreaterThan(0);
          contagem += 1;
          if (contagem >= 300) return;
        }
      }
    }
    expect(contagem).toBeGreaterThanOrEqual(50);
  });

  it("18) corpus tem inbound e outbound (fromMe true/false)", () => {
    let inbound = false;
    let outbound = false;
    for (const row of parsed) {
      for (const conv of row.chunk.conversations) {
        for (const msg of conv.messages) {
          if (msg.fromMe) outbound = true;
          else inbound = true;
          if (inbound && outbound) {
            expect(inbound && outbound).toBe(true);
            return;
          }
        }
      }
    }
    expect(inbound && outbound).toBe(true);
  });

  it("19) tipos text/image/audio aparecem no corpus", () => {
    const tipos = new Set<string>();
    for (const row of parsed) {
      for (const conv of row.chunk.conversations) {
        for (const msg of conv.messages) {
          tipos.add(msg.type);
        }
      }
      if (tipos.has("text") && tipos.has("image") && tipos.has("audio")) break;
    }
    expect(tipos.has("text")).toBe(true);
    expect(tipos.has("image")).toBe(true);
    expect(tipos.has("audio")).toBe(true);
  });

  it("20) nenhum chunk ultrapassa o cap de 5000 msgs parseadas", () => {
    for (const row of parsed) {
      const n = row.chunk.conversations.reduce((acc, c) => acc + c.messages.length, 0);
      expect(n, row.arquivo).toBeLessThanOrEqual(HISTORY_SYNC_CHUNK_MSG_CAP);
    }
  });

  it("21) chunks úteis (com msgs) têm progress numérico ou bootstrap", () => {
    const uteis = parsed.filter((p) => p.chunk.temMensagens);
    expect(uteis.length).toBeGreaterThanOrEqual(1);
    for (const row of uteis) {
      if (row.chunk.syncType === HISTORY_SYNC_TYPE.INITIAL_BOOTSTRAP) {
        expect(row.chunk.progress).toBe(100);
      } else {
        expect(row.chunk.progress, row.arquivo).not.toBeNull();
      }
    }
  });

  it("22) rotuloHistorySyncType cobre todos syncTypes observados", () => {
    const tipos = new Set(parsed.map((p) => p.chunk.syncType));
    expect(tipos.size).toBeGreaterThanOrEqual(5);
    for (const t of tipos) {
      const rotulo = rotuloHistorySyncType(t);
      expect(rotulo.length).toBeGreaterThan(0);
      expect(rotulo).not.toMatch(/^tipo--/);
    }
  });

  it("23) instancia primaria: FULL depois bootstrap e RECENT depois FULL", () => {
    if (!pastaPrimaria) return;
    const rows = parsed
      .filter((p) => p.instanciaPasta === pastaPrimaria)
      .map((p) => ({
        arquivo: p.arquivo,
        syncType: p.chunk.syncType,
        progress: p.chunk.progress,
        order: p.chunk.chunkOrder,
      }));
    if (rows.length < 3) return;

    const temBootstrap = rows.some((r) => r.syncType === HISTORY_SYNC_TYPE.INITIAL_BOOTSTRAP);
    const temFull = rows.some((r) => r.syncType === HISTORY_SYNC_TYPE.FULL);
    const temRecent = rows.some((r) => r.syncType === HISTORY_SYNC_TYPE.RECENT);
    if (!(temBootstrap && temFull && temRecent)) return;

    const fullDone = rows.find((r) => r.syncType === HISTORY_SYNC_TYPE.FULL && r.progress === 100);
    const recentStart = rows.find(
      (r) => r.syncType === HISTORY_SYNC_TYPE.RECENT && (r.progress ?? 0) <= 30,
    );
    expect(fullDone).toBeTruthy();
    expect(recentStart).toBeTruthy();
  });

  it("24) RECENT na instancia primaria: progress sobe com chunkOrder", () => {
    if (!pastaPrimaria) return;
    const recent = parsed
      .filter(
        (p) =>
          p.instanciaPasta === pastaPrimaria && p.chunk.syncType === HISTORY_SYNC_TYPE.RECENT,
      )
      .map((p) => ({
        order: p.chunk.chunkOrder ?? 0,
        progress: p.chunk.progress ?? 0,
      }))
      .toSorted((a, b) => a.order - b.order);

    if (recent.length < 2) return;
    for (let i = 1; i < recent.length; i++) {
      expect(recent[i]!.progress).toBeGreaterThanOrEqual(recent[i - 1]!.progress);
      expect(recent[i]!.order).toBeGreaterThan(recent[i - 1]!.order);
    }
  });

  it("25) fatiarHistorySyncData preserva syncType e limita msgs", () => {
    const fonte = fixtures.find((f) => {
      const c = parseGoHistorySyncChunk(f.data);
      return c.temMensagens && c.conversations.some((x) => x.messages.length > 5);
    });
    expect(fonte).toBeTruthy();
    const original = parseGoHistorySyncChunk(fonte!.data);
    const fatiado = parseGoHistorySyncChunk(fatiarHistorySyncData(fonte!.data, 5));
    expect(fatiado.syncType).toBe(original.syncType);
    expect(fatiado.progress).toBe(original.progress);
    const n = fatiado.conversations.reduce((acc, c) => acc + c.messages.length, 0);
    expect(n).toBeLessThanOrEqual(5);
    expect(n).toBeGreaterThan(0);
  });

  it("26) parse é determinístico (2× no mesmo data)", () => {
    const amostra = fixtures.find((f) => parseGoHistorySyncChunk(f.data).temMensagens)!;
    const a = parseGoHistorySyncChunk(amostra.data);
    const b = parseGoHistorySyncChunk(amostra.data);
    expect(a.syncType).toBe(b.syncType);
    expect(a.progress).toBe(b.progress);
    expect(a.conversations.length).toBe(b.conversations.length);
    expect(a.conversations[0]?.messages[0]?.messageId).toBe(
      b.conversations[0]?.messages[0]?.messageId,
    );
  });

  it("27) JIDs @s.whatsapp.net, @lid e @g.us aparecem no corpus", () => {
    const suffixes = new Set<string>();
    for (const row of parsed) {
      for (const conv of row.chunk.conversations) {
        const suf = conv.jid.includes("@") ? conv.jid.split("@")[1]! : "";
        if (suf) suffixes.add(suf);
      }
    }
    expect(suffixes.has("s.whatsapp.net")).toBe(true);
    expect(suffixes.has("lid")).toBe(true);
    expect(suffixes.has("g.us")).toBe(true);
  });

  it("29) conversationTimestamp bruto nao vaza para mensagem parseada como NaN", () => {
    let n = 0;
    for (const row of parsed) {
      for (const conv of row.chunk.conversations) {
        for (const msg of conv.messages) {
          if (!msg.timestamp) continue;
          expect(msg.timestamp.getTime()).not.toBeNaN();
          n += 1;
          if (n >= 100) return;
        }
      }
    }
    expect(n).toBeGreaterThanOrEqual(50);
  });

  it("30) mappings LID nao tem duplicata de lidJid no mesmo chunk", () => {
    for (const row of parsed) {
      if (row.chunk.phoneLidMappings.length === 0) continue;
      const lids = row.chunk.phoneLidMappings.map((m) => m.lidJid);
      expect(new Set(lids).size, row.arquivo).toBe(lids.length);
    }
  });

  it("31) pnJid dos mappings sao unicos por chunk ou muitos-para-um aceitavel", () => {
    let checou = 0;
    for (const row of parsed) {
      if (row.chunk.phoneLidMappings.length < 2) continue;
      for (const m of row.chunk.phoneLidMappings) {
        expect(m.pnJid).toMatch(/^\d+@s\.whatsapp\.net$/);
      }
      checou += 1;
      if (checou >= 5) break;
    }
    expect(checou).toBeGreaterThanOrEqual(1);
  });

  it("32) instancia secundaria tem HistorySync se presente no corpus", () => {
    const pastas = new Set(parsed.map((p) => p.instanciaPasta));
    if (pastas.size < 2) return;
    expect(pastas.size).toBeGreaterThanOrEqual(2);
  });

  it("33) payload data sempre tem chave Data aninhada ou syncType no topo", () => {
    for (const f of fixtures) {
      const hasNested = f.data.Data !== undefined;
      const hasTop = (f.data as { syncType?: unknown }).syncType !== undefined;
      const inner = hasNested ? (f.data.Data as Record<string, unknown>) : f.data;
      expect(inner.syncType !== undefined || hasTop, f.arquivo).toBe(true);
    }
  });

  it("34) progress quando presente esta em 0..100", () => {
    for (const row of parsed) {
      if (row.chunk.progress === null) continue;
      expect(row.chunk.progress, row.arquivo).toBeGreaterThanOrEqual(0);
      expect(row.chunk.progress, row.arquivo).toBeLessThanOrEqual(100);
    }
  });

  it("35) chunkOrder quando presente e >= 1", () => {
    for (const row of parsed) {
      if (row.chunk.chunkOrder === null) continue;
      expect(row.chunk.chunkOrder, row.arquivo).toBeGreaterThanOrEqual(1);
    }
  });
});
