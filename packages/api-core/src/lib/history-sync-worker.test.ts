/**
 * Contrato fila → Workflow HistorySync (IDs, retries create, lotes curtos).
 */
import { describe, expect, it, vi } from "vitest";
import {
  deveMarcarFalhaAposTentativasFila,
  HISTORY_SYNC_INGEST_LOTE_TAMANHO,
  HISTORY_SYNC_MIDIA_CONCORRENCIA,
  particionarEmLotes,
} from "./history-sync";

/** Espelha apps/history-sync/src/helpers.ts — evita importar Worker no vitest do pacote. */
function idWorkflowHistorySyncChunk(r2Key: string): string {
  const base =
    r2Key
      .split("/")
      .pop()
      ?.replace(/\.json$/i, "") ?? "x";
  return `hs-${base}`.slice(0, 100);
}

function chaveR2MidiaJobsLote(r2KeyChunk: string, loteIngestao: number): string {
  return `${r2KeyChunk}.midia-lote-${loteIngestao}.json`;
}

function truncarErroWorker(erro: string): string {
  return erro.slice(0, 500);
}

type AcaoFila = "retry" | "ack_falha" | "ack_ok";

function decidirAcaoCreateWorkflow(attempts: number, erro: string): AcaoFila {
  if (/already exists|already been used/i.test(erro)) return "ack_ok";
  if (deveMarcarFalhaAposTentativasFila(attempts)) return "ack_falha";
  return "retry";
}

const PASSOS_BASE = [
  "carregar-chunk-r2",
  "resolver-instancia",
  "planejar-chunk",
  "marcar-running",
  "ingerir-lote-0",
  "persistir-midia-0-0",
  "limpar-midia-0",
  "marcar-concluido",
  "marcar-falha",
] as const;

async function simularPersistirMidiasEmLotes(
  jobs: Array<{ externalId: string }>,
  falharIds: Set<string>,
): Promise<{ ok: string[]; falhas: string[] }> {
  const lotes = particionarEmLotes(jobs, HISTORY_SYNC_MIDIA_CONCORRENCIA);
  const ok: string[] = [];
  const falhas: string[] = [];

  await lotes.reduce<Promise<void>>(async (prev, lote) => {
    await prev;
    const resultados = await Promise.allSettled(
      lote.map(async (job) => {
        if (falharIds.has(job.externalId)) throw new Error(`midia ${job.externalId}`);
        return job.externalId;
      }),
    );
    for (let i = 0; i < resultados.length; i++) {
      const r = resultados[i]!;
      const id = lote[i]!.externalId;
      if (r.status === "fulfilled") ok.push(id);
      else falhas.push(id);
    }
  }, Promise.resolve());

  return { ok, falhas };
}

describe("worker history-sync — fila → workflow", () => {
  it("1) ID do workflow e estavel a partir do r2Key", () => {
    const key = "historico-sync/847c01d8-e12b-421d-8e81-7ab8c8844072/2026-07-13/abc-def.json";
    expect(idWorkflowHistorySyncChunk(key)).toBe("hs-abc-def");
    expect(idWorkflowHistorySyncChunk(key)).toBe(idWorkflowHistorySyncChunk(key));
  });

  it("2) ID respeita limite de 100 chars", () => {
    const longo = `historico-sync/u/2026-07-13/${"a".repeat(120)}.json`;
    expect(idWorkflowHistorySyncChunk(longo).length).toBeLessThanOrEqual(100);
    expect(idWorkflowHistorySyncChunk(longo).startsWith("hs-")).toBe(true);
  });

  it("3) chave staging midia por lote de ingestao", () => {
    expect(chaveR2MidiaJobsLote("historico-sync/u/d/x.json", 2)).toBe(
      "historico-sync/u/d/x.json.midia-lote-2.json",
    );
  });

  it("4) create ja existente → ack (nao marca failed)", () => {
    expect(decidirAcaoCreateWorkflow(1, "Workflow instance already exists")).toBe("ack_ok");
  });

  it("5) create falha attempts 1-4 → retry", () => {
    expect(decidirAcaoCreateWorkflow(1, "rate limited")).toBe("retry");
    expect(decidirAcaoCreateWorkflow(4, "timeout")).toBe("retry");
  });

  it("6) create falha attempts 5+ → ack_falha", () => {
    expect(decidirAcaoCreateWorkflow(5, "boom")).toBe("ack_falha");
  });

  it("7) passos base do workflow (lotes dinamicos alem destes)", () => {
    expect(PASSOS_BASE).toContain("planejar-chunk");
    expect(PASSOS_BASE).toContain("ingerir-lote-0");
    expect(PASSOS_BASE).toContain("persistir-midia-0-0");
    expect(PASSOS_BASE).toContain("marcar-falha");
  });

  it("8) erro truncado em 500 chars", () => {
    expect(truncarErroWorker("x".repeat(800))).toHaveLength(500);
  });

  it("8b) 100 msgs → 4 steps ingerir-lote", () => {
    expect(Math.ceil(100 / HISTORY_SYNC_INGEST_LOTE_TAMANHO)).toBe(4);
  });
});

describe("worker history-sync — midias em lotes", () => {
  it("9) 9 jobs viram 3 lotes de 4", () => {
    const jobs = Array.from({ length: 9 }, (_, i) => ({ externalId: `M${i}` }));
    expect(particionarEmLotes(jobs, HISTORY_SYNC_MIDIA_CONCORRENCIA)).toHaveLength(3);
  });

  it("10) falha em um job do lote nao impede os outros", async () => {
    const jobs = [{ externalId: "A" }, { externalId: "B" }, { externalId: "C" }];
    const r = await simularPersistirMidiasEmLotes(jobs, new Set(["B"]));
    expect(r.ok).toEqual(["A", "C"]);
    expect(r.falhas).toEqual(["B"]);
  });

  it("11) lotes em serie", async () => {
    const ordem: string[] = [];
    const jobs = Array.from({ length: 6 }, (_, i) => ({ externalId: `J${i}` }));
    const lotes = particionarEmLotes(jobs, 2);
    await lotes.reduce<Promise<void>>(async (prev, lote) => {
      await prev;
      ordem.push(lote.map((j) => j.externalId).join(","));
    }, Promise.resolve());
    expect(ordem).toEqual(["J0,J1", "J2,J3", "J4,J5"]);
  });

  it("12) reject logavel", async () => {
    const warn = vi.fn();
    const r = await simularPersistirMidiasEmLotes(
      [{ externalId: "OK" }, { externalId: "BAD" }],
      new Set(["BAD"]),
    );
    if (r.falhas.length) warn(r.falhas[0]);
    expect(warn).toHaveBeenCalledWith("BAD");
  });
});
