/**
 * Integracao HistorySync -> Postgres com corpus R2.
 * Requer DATABASE_URL e schema atual (tabela instancia_evo).
 * Se o banco local estiver atrasado, a suite e pulada (rode as migrations).
 */
import { existsSync } from "node:fs";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { HISTORY_SYNC_TYPE, parseGoHistorySyncChunk } from "@whasap/evolution";
import {
  colunasSomenteId,
  comTimestampsCriacao,
  conversa,
  criarDb,
  instancia,
  instanciaEvo,
  mensagem,
  organizacao,
  type Db,
} from "@whasap/db";
import { and, eq, isNull } from "drizzle-orm";

import {
  carregarHistorySyncR2,
  fatiarHistorySyncData,
} from "../../../evolution/src/fixtures/carregar-history-sync-r2";
import {
  atualizarProgressoHistoricoSync,
  concluirHistoricosSyncOciosos,
  processarHistorySyncChunk,
} from "./history-sync";
import { ingerirMensagem } from "./ingestao-mensagem";

const DATABASE_URL = process.env.DATABASE_URL;
const corpusPath = join(import.meta.dirname, "../../../r2-sync/json/webhook/evo");
const corpusOk = existsSync(corpusPath);

async function schemaTemInstanciaEvo(url: string): Promise<boolean> {
  const { sql } = criarDb(url);
  try {
    const rows = await sql<{ t: string | null }[]>`select to_regclass('public.instancia_evo') as t`;
    return Boolean(rows[0]?.t);
  } catch {
    return false;
  } finally {
    await sql.end({ timeout: 5 });
  }
}

const schemaOk = DATABASE_URL ? await schemaTemInstanciaEvo(DATABASE_URL) : false;
const podeRodar = Boolean(DATABASE_URL && corpusOk && schemaOk);

if (DATABASE_URL && corpusOk && !schemaOk) {
  console.warn(
    "[history-sync.integration] Schema local desatualizado (falta instancia_evo). " +
      "Aplique as migrations do Drizzle para habilitar estes testes.",
  );
}

describe.skipIf(!podeRodar)("HistorySync ingestao (Postgres + corpus R2)", () => {
  let db: Db;
  let fechar: () => Promise<void>;
  let orgId: number;
  let instanciaId: number;
  let instanciaUuid: string;
  const slug = `hist-sync-test-${crypto.randomUUID().slice(0, 8)}`;

  const fixtures = podeRodar ? carregarHistorySyncR2({ instanciaPasta: "whasap-847c01d8" }) : [];

  beforeAll(async () => {
    const { db: database, sql: pool } = criarDb(DATABASE_URL!);
    db = database;
    fechar = async () => {
      await pool.end({ timeout: 5 });
    };

    const [org] = await db
      .insert(organizacao)
      .values(comTimestampsCriacao({ nome: "Hist Sync Test", slug }))
      .returning({ id: organizacao.id });
    orgId = org!.id;

    const [inst] = await db
      .insert(instancia)
      .values(
        comTimestampsCriacao({
          organizacaoId: orgId,
          nome: "ClinicaWork Test Sync",
          provedor: "evo",
          status: "connected",
        }),
      )
      .returning({ id: instancia.id, uuid: instancia.uuid });
    instanciaId = inst!.id;
    instanciaUuid = inst!.uuid;

    await db.insert(instanciaEvo).values(
      comTimestampsCriacao({
        instanciaId,
        nomeInstancia: `whasap-test-${slug}`,
        token: "test-token-hist-sync",
        historicoSyncStatus: "requested",
        historicoSyncProgress: 0,
      }),
    );
  });

  afterAll(async () => {
    if (!db) return;
    try {
      await db.delete(organizacao).where(eq(organizacao.id, orgId));
    } finally {
      await fechar();
    }
  });

  function instanceCtx() {
    return {
      id: instanciaId,
      organizacaoId: orgId,
      uuid: instanciaUuid,
      evoToken: "test-token-hist-sync",
    };
  }

  function buscarFixture(pred: (data: Record<string, unknown>) => boolean) {
    const hit = fixtures.find((f) => pred(f.data));
    if (!hit) throw new Error("fixture HistorySync nao encontrada no corpus");
    return hit;
  }

  it("01) corpus ClinicaWork disponivel", () => {
    expect(fixtures.length).toBeGreaterThanOrEqual(10);
  });

  it("02) metadata syncType 5 e ignorada", async () => {
    const fix = buscarFixture((d) => {
      const c = parseGoHistorySyncChunk(d);
      return c.syncType === HISTORY_SYNC_TYPE.NON_BLOCKING_DATA;
    });
    const result = await processarHistorySyncChunk(db, instanceCtx(), fix.data);
    expect(result.ignorado).toBe(true);
    expect(result.concluido).toBe(false);
    expect(result.midiaJobs).toHaveLength(0);
  });

  it("03) fatia real grava mensagens no banco", async () => {
    const fix = buscarFixture((d) => {
      const c = parseGoHistorySyncChunk(d);
      return c.temMensagens && c.syncType === HISTORY_SYNC_TYPE.RECENT;
    });
    const data = fatiarHistorySyncData(fix.data, 8);
    const chunk = parseGoHistorySyncChunk(data);
    const ids = chunk.conversations.flatMap((c) => c.messages.map((m) => m.messageId));
    expect(ids.length).toBeGreaterThan(0);

    const result = await processarHistorySyncChunk(db, instanceCtx(), data);
    expect(result.ignorado).toBe(false);

    for (const idExterno of ids) {
      const row = await db.query.mensagem.findFirst({
        where: and(eq(mensagem.idExterno, idExterno), isNull(mensagem.excluidoEm)),
        columns: { id: true, conversaId: true, tipo: true, corpo: true },
      });
      expect(row, idExterno).toBeTruthy();
      expect(row!.corpo?.length ?? 0).toBeGreaterThan(0);
    }
  });

  it("04) regressao: Date antigo (2024) atualiza ultima_mensagem_em sem Failed query", async () => {
    const ts = new Date("2024-09-18T14:27:40.000Z");
    const externalId = `hist-ts-${crypto.randomUUID()}`;

    const result = await ingerirMensagem(db, {
      instanciaId,
      organizacaoId: orgId,
      phone: "5511999990001",
      contactName: "Regressao Timestamp",
      idExternoLinha: "5511999990001@s.whatsapp.net",
      idExternoCanonico: "5511999990001@s.whatsapp.net",
      body: "msg historica",
      type: "text",
      externalId,
      provedor: "evo",
      direcao: "inbound",
      criadoEm: ts,
      ultimaMensagemEm: ts,
    });

    expect(result).toBeTruthy();
    expect(result!.created).toBe(true);

    const conv = await db.query.conversa.findFirst({
      where: eq(conversa.id, result!.conversaId),
      columns: { ultimaMensagemEm: true },
    });
    expect(conv?.ultimaMensagemEm?.toISOString()).toBe(ts.toISOString());
  });

  it("05) ultima_mensagem_em e monotonica (msg mais antiga nao regride)", async () => {
    const phone = "5511999990002";
    const canon = `${phone}@s.whatsapp.net`;
    const recente = new Date("2026-01-10T12:00:00.000Z");
    const antiga = new Date("2024-01-10T12:00:00.000Z");

    const r1 = await ingerirMensagem(db, {
      instanciaId,
      organizacaoId: orgId,
      phone,
      contactName: "Mono",
      idExternoLinha: canon,
      idExternoCanonico: canon,
      body: "recente",
      type: "text",
      externalId: `mono-new-${crypto.randomUUID()}`,
      provedor: "evo",
      direcao: "inbound",
      criadoEm: recente,
      ultimaMensagemEm: recente,
    });
    expect(r1).toBeTruthy();

    await ingerirMensagem(db, {
      instanciaId,
      organizacaoId: orgId,
      phone,
      contactName: "Mono",
      idExternoLinha: canon,
      idExternoCanonico: canon,
      body: "antiga",
      type: "text",
      externalId: `mono-old-${crypto.randomUUID()}`,
      provedor: "evo",
      direcao: "inbound",
      criadoEm: antiga,
      ultimaMensagemEm: antiga,
    });

    const conv = await db.query.conversa.findFirst({
      where: eq(conversa.id, r1!.conversaId),
      columns: { ultimaMensagemEm: true },
    });
    expect(conv?.ultimaMensagemEm?.toISOString()).toBe(recente.toISOString());
  });

  it("06) idempotencia por externalId (mesmo chunk 2x)", async () => {
    const fix = buscarFixture((d) => parseGoHistorySyncChunk(d).temMensagens);
    const data = fatiarHistorySyncData(fix.data, 3);
    const chunk = parseGoHistorySyncChunk(data);
    const id = chunk.conversations.flatMap((c) => c.messages.map((m) => m.messageId))[0]!;

    await processarHistorySyncChunk(db, instanceCtx(), data);
    await processarHistorySyncChunk(db, instanceCtx(), data);

    const rows = await db.query.mensagem.findMany({
      where: and(eq(mensagem.idExterno, id), isNull(mensagem.excluidoEm)),
      columns: colunasSomenteId,
    });
    expect(rows).toHaveLength(1);
  });

  it("07) LID no chunk resolve contato canonico @s.whatsapp.net", async () => {
    const fix = buscarFixture((d) => {
      const c = parseGoHistorySyncChunk(d);
      if (c.phoneLidMappings.length === 0) return false;
      const mapa = new Set(c.phoneLidMappings.map((m) => m.lidJid));
      return c.conversations.some(
        (conv) => conv.jid.endsWith("@lid") && mapa.has(conv.jid) && conv.messages.length > 0,
      );
    });

    const chunkFull = parseGoHistorySyncChunk(fix.data);
    const mapa = new Map(chunkFull.phoneLidMappings.map((m) => [m.lidJid, m.pnJid]));
    const convLid = chunkFull.conversations.find(
      (c) => c.jid.endsWith("@lid") && mapa.has(c.jid) && c.messages.length > 0,
    )!;
    const pn = mapa.get(convLid.jid)!;
    const uniqueId = `lid-test-${crypto.randomUUID().slice(0, 8)}`;

    const data = {
      Data: {
        syncType: chunkFull.syncType,
        progress: chunkFull.progress,
        chunkOrder: chunkFull.chunkOrder,
        phoneNumberToLidMappings: chunkFull.phoneLidMappings.map((m) => ({
          pnJID: m.pnJid,
          lidJID: m.lidJid,
        })),
        conversations: [
          {
            ID: convLid.jid,
            name: convLid.nome,
            unreadCount: convLid.unreadCount,
            messages: [
              {
                message: {
                  key: {
                    remoteJID: convLid.jid,
                    fromMe: convLid.messages[0]!.fromMe,
                    ID: uniqueId,
                  },
                  message: { conversation: "teste lid canonico" },
                  messageTimestamp: Math.floor(Date.now() / 1000) - 3600,
                },
              },
            ],
          },
        ],
      },
    };

    const result = await processarHistorySyncChunk(db, instanceCtx(), data);
    expect(result.ignorado).toBe(false);

    const msg = await db.query.mensagem.findFirst({
      where: and(eq(mensagem.idExterno, uniqueId), isNull(mensagem.excluidoEm)),
      columns: { conversaId: true },
      with: {
        conversa: {
          columns: { id: true },
          with: { contato: { columns: { idExterno: true } } },
        },
      },
    });
    expect(msg?.conversa?.contato?.idExterno).toBe(pn);
  });

  it("08) imagem no historico enfileira midiaJob quando ha token", async () => {
    const fix = buscarFixture((d) => {
      const c = parseGoHistorySyncChunk(d);
      return c.conversations.some((conv) => conv.messages.some((m) => m.type === "image"));
    });
    const chunk = parseGoHistorySyncChunk(fix.data);
    const imagem = chunk.conversations
      .flatMap((c) => c.messages.map((m) => ({ conv: c, msg: m })))
      .find((x) => x.msg.type === "image")!;

    const uniqueId = `img-${crypto.randomUUID().slice(0, 10)}`;
    const data = {
      Data: {
        syncType: chunk.syncType,
        progress: chunk.progress ?? 50,
        conversations: [
          {
            ID: imagem.conv.jid,
            messages: [
              {
                message: {
                  key: {
                    remoteJID: imagem.msg.chatJid,
                    fromMe: imagem.msg.fromMe,
                    ID: uniqueId,
                  },
                  message: imagem.msg.messageObj,
                  messageTimestamp: Math.floor(
                    (imagem.msg.timestamp?.getTime() ?? Date.now()) / 1000,
                  ),
                },
              },
            ],
          },
        ],
      },
    };

    const result = await processarHistorySyncChunk(db, instanceCtx(), data);
    expect(result.ignorado).toBe(false);
    expect(result.midiaJobs.some((j) => j.externalId === uniqueId)).toBe(true);
    expect(result.midiaJobs.find((j) => j.externalId === uniqueId)?.type).toBe("image");
  });

  it("09) processar chunk util marca historicoSyncStatus=running", async () => {
    const fix = buscarFixture((d) => parseGoHistorySyncChunk(d).temMensagens);
    const data = fatiarHistorySyncData(fix.data, 2);
    await processarHistorySyncChunk(db, instanceCtx(), data);

    const evo = await db.query.instanciaEvo.findFirst({
      where: eq(instanciaEvo.instanciaId, instanciaId),
      columns: {
        historicoSyncStatus: true,
        historicoSyncProgress: true,
        historicoSincronizandoEm: true,
      },
    });
    expect(evo?.historicoSyncStatus).toBe("running");
    expect(evo?.historicoSincronizandoEm).toBeTruthy();
  });

  it("10) RECENT @ 100 retorna concluido=true", async () => {
    const fix = buscarFixture((d) => {
      const c = parseGoHistorySyncChunk(d);
      return c.syncType === HISTORY_SYNC_TYPE.RECENT && c.progress === 100 && c.temMensagens;
    });
    const data = fatiarHistorySyncData(fix.data, 2);
    const result = await processarHistorySyncChunk(db, instanceCtx(), data);
    expect(result.concluido).toBe(true);
    expect(result.ignorado).toBe(false);
  });

  it("11) FULL @ 100 retorna concluido=false", async () => {
    const fix = buscarFixture((d) => {
      const c = parseGoHistorySyncChunk(d);
      return c.syncType === HISTORY_SYNC_TYPE.FULL && c.progress === 100 && c.temMensagens;
    });
    const data = fatiarHistorySyncData(fix.data, 2);
    const result = await processarHistorySyncChunk(db, instanceCtx(), data);
    expect(result.concluido).toBe(false);
  });

  it("12) bootstrap @ 100 retorna concluido=false", async () => {
    const fix = buscarFixture((d) => {
      const c = parseGoHistorySyncChunk(d);
      return (
        c.syncType === HISTORY_SYNC_TYPE.INITIAL_BOOTSTRAP && c.progress === 100 && c.temMensagens
      );
    });
    const data = fatiarHistorySyncData(fix.data, 2);
    const result = await processarHistorySyncChunk(db, instanceCtx(), data);
    expect(result.concluido).toBe(false);
  });

  it("13) ordem cronologica: ultimaMensagemEm = timestamp mais novo do lote", async () => {
    const phone = "5511999990003";
    const canon = `${phone}@s.whatsapp.net`;
    const t1 = new Date("2025-03-01T10:00:00.000Z");
    const t2 = new Date("2025-03-01T12:00:00.000Z");
    const t3 = new Date("2025-03-01T11:00:00.000Z");

    const data = {
      Data: {
        syncType: HISTORY_SYNC_TYPE.RECENT,
        progress: 40,
        conversations: [
          {
            ID: canon,
            messages: [
              {
                message: {
                  key: { remoteJID: canon, fromMe: false, ID: `ord-${crypto.randomUUID()}-a` },
                  message: { conversation: "t1" },
                  messageTimestamp: Math.floor(t1.getTime() / 1000),
                },
              },
              {
                message: {
                  key: { remoteJID: canon, fromMe: true, ID: `ord-${crypto.randomUUID()}-b` },
                  message: { conversation: "t2" },
                  messageTimestamp: Math.floor(t2.getTime() / 1000),
                },
              },
              {
                message: {
                  key: { remoteJID: canon, fromMe: false, ID: `ord-${crypto.randomUUID()}-c` },
                  message: { conversation: "t3" },
                  messageTimestamp: Math.floor(t3.getTime() / 1000),
                },
              },
            ],
          },
        ],
      },
    };

    await processarHistorySyncChunk(db, instanceCtx(), data);

    const alvo = await db.query.conversa.findMany({
      where: and(eq(conversa.instanciaId, instanciaId), isNull(conversa.excluidoEm)),
      columns: { id: true, ultimaMensagemEm: true },
      with: { contato: { columns: { idExterno: true } } },
    });
    const row = alvo.find((c) => c.contato?.idExterno === canon);
    expect(row?.ultimaMensagemEm?.toISOString()).toBe(t2.toISOString());
  });

  it("14) outbound e inbound no mesmo chunk", async () => {
    const phone = "5511999990004";
    const canon = `${phone}@s.whatsapp.net`;
    const idIn = `dir-in-${crypto.randomUUID().slice(0, 8)}`;
    const idOut = `dir-out-${crypto.randomUUID().slice(0, 8)}`;
    const data = {
      Data: {
        syncType: HISTORY_SYNC_TYPE.RECENT,
        progress: 55,
        conversations: [
          {
            ID: canon,
            messages: [
              {
                message: {
                  key: { remoteJID: canon, fromMe: false, ID: idIn },
                  message: { conversation: "cliente" },
                  messageTimestamp: Math.floor(Date.now() / 1000) - 10,
                },
              },
              {
                message: {
                  key: { remoteJID: canon, fromMe: true, ID: idOut },
                  message: { conversation: "atendente" },
                  messageTimestamp: Math.floor(Date.now() / 1000) - 5,
                },
              },
            ],
          },
        ],
      },
    };

    await processarHistorySyncChunk(db, instanceCtx(), data);

    const inbound = await db.query.mensagem.findFirst({
      where: eq(mensagem.idExterno, idIn),
      columns: { direcao: true },
    });
    const outbound = await db.query.mensagem.findFirst({
      where: eq(mensagem.idExterno, idOut),
      columns: { direcao: true },
    });
    expect(inbound?.direcao).toBe("inbound");
    expect(outbound?.direcao).toBe("outbound");
  });

  it("15) atualizarProgressoHistoricoSync marca failed", async () => {
    await atualizarProgressoHistoricoSync(db, instanciaId, {
      status: "failed",
      erro: "Falha ao gravar mensagens do historico",
    });
    const evo = await db.query.instanciaEvo.findFirst({
      where: eq(instanciaEvo.instanciaId, instanciaId),
      columns: { historicoSyncStatus: true, historicoSyncErro: true },
    });
    expect(evo?.historicoSyncStatus).toBe("failed");
    expect(evo?.historicoSyncErro).toContain("historico");
  });

  it("16) concluirHistoricosSyncOciosos completa sync parado ha >5min", async () => {
    const antigo = new Date(Date.now() - 10 * 60 * 1000);
    await db
      .update(instanciaEvo)
      .set({
        historicoSyncStatus: "running",
        historicoSincronizandoEm: antigo,
        historicoSyncErro: null,
        atualizadoEm: new Date(),
      })
      .where(eq(instanciaEvo.instanciaId, instanciaId));

    const n = await concluirHistoricosSyncOciosos(db);
    expect(n).toBeGreaterThanOrEqual(1);

    const evo = await db.query.instanciaEvo.findFirst({
      where: eq(instanciaEvo.instanciaId, instanciaId),
      columns: {
        historicoSyncStatus: true,
        historicoSincronizadoEm: true,
        historicoSincronizandoEm: true,
      },
    });
    expect(evo?.historicoSyncStatus).toBe("completed");
    expect(evo?.historicoSincronizadoEm).toBeTruthy();
    expect(evo?.historicoSincronizandoEm).toBeNull();
  });

  it("17) grupo @g.us cria conversa com idExterno do grupo", async () => {
    const fix = buscarFixture((d) => {
      const c = parseGoHistorySyncChunk(d);
      return c.conversations.some((x) => x.jid.endsWith("@g.us") && x.messages.length > 0);
    });
    const chunk = parseGoHistorySyncChunk(fix.data);
    const grupo = chunk.conversations.find(
      (c) => c.jid.endsWith("@g.us") && c.messages.length > 0,
    )!;
    const uniqueId = `grp-${crypto.randomUUID().slice(0, 8)}`;
    const data = {
      Data: {
        syncType: chunk.syncType,
        progress: chunk.progress ?? 20,
        conversations: [
          {
            ID: grupo.jid,
            name: grupo.nome,
            messages: [
              {
                message: {
                  key: {
                    remoteJID: grupo.jid,
                    fromMe: true,
                    ID: uniqueId,
                  },
                  message: { conversation: "msg grupo teste" },
                  messageTimestamp: Math.floor(Date.now() / 1000) - 100,
                },
              },
            ],
          },
        ],
      },
    };

    await processarHistorySyncChunk(db, instanceCtx(), data);
    const msg = await db.query.mensagem.findFirst({
      where: eq(mensagem.idExterno, uniqueId),
      columns: { conversaId: true },
      with: {
        conversa: { with: { contato: { columns: { idExterno: true } } } },
      },
    });
    expect(msg?.conversa?.contato?.idExterno).toBe(grupo.jid);
  });

  it("18) metadados origemHistorico gravados na mensagem", async () => {
    const externalId = `meta-hist-${crypto.randomUUID().slice(0, 8)}`;
    const phone = "5511999990005";
    const canon = `${phone}@s.whatsapp.net`;
    const data = {
      Data: {
        syncType: HISTORY_SYNC_TYPE.FULL,
        progress: 12,
        conversations: [
          {
            ID: canon,
            messages: [
              {
                message: {
                  key: { remoteJID: canon, fromMe: false, ID: externalId },
                  message: { conversation: "com meta" },
                  messageTimestamp: Math.floor(Date.now() / 1000) - 50,
                },
              },
            ],
          },
        ],
      },
    };

    await processarHistorySyncChunk(db, instanceCtx(), data);
    const row = await db.query.mensagem.findFirst({
      where: eq(mensagem.idExterno, externalId),
      columns: { metadados: true },
    });
    const meta = row?.metadados as Record<string, unknown> | null;
    expect(meta?.origemHistorico).toBe(true);
    expect(meta?.syncType).toBe(HISTORY_SYNC_TYPE.FULL);
  });

  it("19) ON_DEMAND nao altera historicoSyncStatus da instancia", async () => {
    await db
      .update(instanciaEvo)
      .set({
        historicoSyncStatus: "requested",
        historicoSyncProgress: 10,
        atualizadoEm: new Date(),
      })
      .where(eq(instanciaEvo.instanciaId, instanciaId));

    const externalId = `ond-${crypto.randomUUID().slice(0, 8)}`;
    const data = {
      Data: {
        syncType: HISTORY_SYNC_TYPE.ON_DEMAND,
        progress: null,
        conversations: [
          {
            ID: "5511999990099@s.whatsapp.net",
            messages: [
              {
                message: {
                  key: {
                    remoteJID: "5511999990099@s.whatsapp.net",
                    fromMe: false,
                    ID: externalId,
                  },
                  message: { conversation: "on demand" },
                  messageTimestamp: Math.floor(Date.now() / 1000) - 30,
                },
              },
            ],
          },
        ],
      },
    };

    const result = await processarHistorySyncChunk(db, instanceCtx(), data);
    expect(result.concluido).toBe(false);

    const evo = await db.query.instanciaEvo.findFirst({
      where: eq(instanciaEvo.instanciaId, instanciaId),
      columns: { historicoSyncStatus: true, historicoSyncProgress: true },
    });
    expect(evo?.historicoSyncStatus).toBe("requested");
    expect(evo?.historicoSyncProgress).toBe(10);
  });

  it("20) naoLidasInicial da conversa gravado no banco", async () => {
    const phone = "5511999990010";
    const canon = `${phone}@s.whatsapp.net`;
    const externalId = `unread-${crypto.randomUUID().slice(0, 8)}`;
    const data = {
      Data: {
        syncType: HISTORY_SYNC_TYPE.RECENT,
        progress: 20,
        conversations: [
          {
            ID: canon,
            unreadCount: 7,
            messages: [
              {
                message: {
                  key: { remoteJID: canon, fromMe: false, ID: externalId },
                  message: { conversation: "nao lidas" },
                  messageTimestamp: Math.floor(Date.now() / 1000) - 20,
                },
              },
            ],
          },
        ],
      },
    };

    const result = await processarHistorySyncChunk(db, instanceCtx(), data);
    expect(result.ignorado).toBe(false);

    const msg = await db.query.mensagem.findFirst({
      where: eq(mensagem.idExterno, externalId),
      columns: { conversaId: true },
    });
    const conv = await db.query.conversa.findFirst({
      where: eq(conversa.id, msg!.conversaId),
      columns: { naoLidas: true },
    });
    expect(conv?.naoLidas).toBe(7);
  });

  it("21) sem evoToken nao retorna midiaJobs", async () => {
    const fix = buscarFixture((d) => {
      const c = parseGoHistorySyncChunk(d);
      return c.conversations.some((conv) => conv.messages.some((m) => m.type === "image"));
    });
    const chunk = parseGoHistorySyncChunk(fix.data);
    const imagem = chunk.conversations
      .flatMap((c) => c.messages.map((m) => ({ conv: c, msg: m })))
      .find((x) => x.msg.type === "image")!;
    const uniqueId = `notok-${crypto.randomUUID().slice(0, 8)}`;
    const data = {
      Data: {
        syncType: chunk.syncType,
        progress: chunk.progress ?? 50,
        conversations: [
          {
            ID: imagem.conv.jid,
            messages: [
              {
                message: {
                  key: {
                    remoteJID: imagem.msg.chatJid,
                    fromMe: imagem.msg.fromMe,
                    ID: uniqueId,
                  },
                  message: imagem.msg.messageObj,
                  messageTimestamp: Math.floor(
                    (imagem.msg.timestamp?.getTime() ?? Date.now()) / 1000,
                  ),
                },
              },
            ],
          },
        ],
      },
    };

    const result = await processarHistorySyncChunk(db, { ...instanceCtx(), evoToken: null }, data);
    expect(result.midiaJobs).toHaveLength(0);
  });

  it("22) video no historico enfileira midiaJob com mime", async () => {
    const uniqueId = `vid-${crypto.randomUUID().slice(0, 8)}`;
    const canon = "5511999990011@s.whatsapp.net";
    const data = {
      Data: {
        syncType: HISTORY_SYNC_TYPE.RECENT,
        progress: 30,
        conversations: [
          {
            ID: canon,
            messages: [
              {
                message: {
                  key: { remoteJID: canon, fromMe: false, ID: uniqueId },
                  message: { videoMessage: { mimetype: "video/mp4", caption: "clip" } },
                  messageTimestamp: Math.floor(Date.now() / 1000) - 15,
                },
              },
            ],
          },
        ],
      },
    };

    const result = await processarHistorySyncChunk(db, instanceCtx(), data);
    const job = result.midiaJobs.find((j) => j.externalId === uniqueId);
    expect(job?.type).toBe("video");
    expect(job?.mimeType).toBe("video/mp4");
  });

  it("23) RECENT @ 100 marca completed no banco", async () => {
    await db
      .update(instanciaEvo)
      .set({
        historicoSyncStatus: "running",
        historicoSyncProgress: 90,
        historicoSincronizandoEm: new Date(),
        atualizadoEm: new Date(),
      })
      .where(eq(instanciaEvo.instanciaId, instanciaId));

    const fix = buscarFixture((d) => {
      const c = parseGoHistorySyncChunk(d);
      return c.syncType === HISTORY_SYNC_TYPE.RECENT && c.progress === 100 && c.temMensagens;
    });
    const data = fatiarHistorySyncData(fix.data, 2);
    await processarHistorySyncChunk(db, instanceCtx(), data);

    const evo = await db.query.instanciaEvo.findFirst({
      where: eq(instanciaEvo.instanciaId, instanciaId),
      columns: {
        historicoSyncStatus: true,
        historicoSincronizadoEm: true,
        historicoSincronizandoEm: true,
        historicoSyncErro: true,
      },
    });
    expect(evo?.historicoSyncStatus).toBe("completed");
    expect(evo?.historicoSincronizadoEm).toBeTruthy();
    expect(evo?.historicoSincronizandoEm).toBeNull();
    expect(evo?.historicoSyncErro).toBeNull();
  });
});
