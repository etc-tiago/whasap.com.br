/**
 * Carrega HistorySync reais do corpus R2 local (webhook/evo).
 * Envelope: receivedAt + meta + raw (webhook Evolution GO em string JSON).
 */
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const RAIZ_R2_EVO = join(import.meta.dirname, "../../../r2-sync/json/webhook/evo");

export type EnvelopeR2HistorySync = {
  receivedAt: string;
  meta: Record<string, string>;
  raw: string;
};

export type FixtureHistorySyncR2 = {
  /** Caminho relativo a webhook/evo (instancia/data/HistorySync-xxx.json). */
  arquivo: string;
  instanciaPasta: string;
  envelope: EnvelopeR2HistorySync;
  /** Payload completo do webhook (event, data, instanceName, ...). */
  payload: Record<string, unknown>;
  /** payload.data - o que o webhook passa a parseGoHistorySyncChunk / fila. */
  data: Record<string, unknown>;
};

function listarArquivosHistorySync(raiz: string): string[] {
  if (!existsSync(raiz)) return [];
  const out: string[] = [];
  for (const instanciaPasta of readdirSync(raiz)) {
    const dirInst = join(raiz, instanciaPasta);
    if (!statSync(dirInst).isDirectory()) continue;
    for (const dia of readdirSync(dirInst)) {
      const dirDia = join(dirInst, dia);
      if (!statSync(dirDia).isDirectory()) continue;
      for (const nome of readdirSync(dirDia)) {
        if (!nome.startsWith("HistorySync-") || !nome.endsWith(".json")) continue;
        out.push(join(instanciaPasta, dia, nome));
      }
    }
  }
  return out.toSorted();
}

/** True se o corpus R2 local tem pelo menos um HistorySync. */
export function corpusHistorySyncR2Disponivel(): boolean {
  return listarArquivosHistorySync(RAIZ_R2_EVO).length > 0;
}

/** Carrega todos os HistorySync do corpus R2 local (pode ser pesado - cachear no teste). */
export function carregarHistorySyncR2(opts?: {
  /** Filtra por pasta de instancia (whasap-847c01d8). */
  instanciaPasta?: string;
  /** Limite de arquivos (util em smoke). */
  limite?: number;
}): FixtureHistorySyncR2[] {
  let paths = listarArquivosHistorySync(RAIZ_R2_EVO);
  if (opts?.instanciaPasta) {
    paths = paths.filter((p) => p.startsWith(`${opts.instanciaPasta}/`));
  }
  if (opts?.limite !== undefined) {
    paths = paths.slice(0, opts.limite);
  }

  return paths.map((rel) => {
    const absolute = join(RAIZ_R2_EVO, rel);
    const envelope = JSON.parse(readFileSync(absolute, "utf8")) as EnvelopeR2HistorySync;
    const payload = JSON.parse(envelope.raw) as Record<string, unknown>;
    const data = (payload.data ?? {}) as Record<string, unknown>;
    return {
      arquivo: rel,
      instanciaPasta: rel.split("/")[0]!,
      envelope,
      payload,
      data,
    };
  });
}

/**
 * Reduz um data HistorySync a no maximo maxMensagens (preserva syncType/progress/mappings).
 * Uso: testes de ingestao sem processar 5k msgs.
 */
export function fatiarHistorySyncData(
  data: Record<string, unknown>,
  maxMensagens: number,
): Record<string, unknown> {
  const inner = structuredClone((data.Data ?? data) as Record<string, unknown>);
  const convs = (inner.conversations as Array<Record<string, unknown>> | undefined) ?? [];
  let restantes = maxMensagens;
  const fatiadas: Array<Record<string, unknown>> = [];

  for (const conv of convs) {
    if (restantes <= 0) break;
    const msgs = (conv.messages as unknown[] | undefined) ?? [];
    if (msgs.length === 0) {
      fatiadas.push(conv);
      continue;
    }
    const pedaco = msgs.slice(0, restantes);
    restantes -= pedaco.length;
    fatiadas.push({ ...conv, messages: pedaco });
  }

  inner.conversations = fatiadas;
  if (data.Data !== undefined) {
    return { ...data, Data: inner };
  }
  return inner;
}
