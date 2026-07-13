/**
 * Carrega ações outbound reais do corpus R2 local (`acao/evo`).
 * Envelope canônico: at + provedor + acao + request + response + meta.
 */
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const RAIZ_R2_ACAO = join(import.meta.dirname, "../../../r2-sync/json/acao/evo");

export type EnvelopeAcaoR2 = {
  at: string;
  provedor: string;
  acao: string;
  request: {
    url: string;
    tipo: string;
    body?: unknown;
  };
  response: {
    status: number | null;
    body?: unknown;
    error?: string | null;
    durationMs?: number;
  };
  meta: Record<string, unknown>;
  derivado?: Record<string, unknown>;
};

export type FixtureAcaoR2 = {
  /** Relativo a acao/evo (uuid/acao/data/arquivo.json). */
  arquivo: string;
  instanciaUuid: string;
  acao: string;
  envelope: EnvelopeAcaoR2;
};

function listarArquivosAcao(raiz: string, acaoFiltro?: string): string[] {
  if (!existsSync(raiz)) return [];
  const out: string[] = [];
  for (const instanciaUuid of readdirSync(raiz)) {
    const dirInst = join(raiz, instanciaUuid);
    if (!statSync(dirInst).isDirectory()) continue;
    for (const acao of readdirSync(dirInst)) {
      if (acaoFiltro && acao !== acaoFiltro) continue;
      const dirAcao = join(dirInst, acao);
      if (!statSync(dirAcao).isDirectory()) continue;
      for (const dia of readdirSync(dirAcao)) {
        const dirDia = join(dirAcao, dia);
        if (!statSync(dirDia).isDirectory()) continue;
        for (const nome of readdirSync(dirDia)) {
          if (!nome.endsWith(".json")) continue;
          out.push(join(instanciaUuid, acao, dia, nome));
        }
      }
    }
  }
  return out.toSorted();
}

/** True se o corpus R2 local tem ao menos uma ação outbound. */
export function corpusAcaoR2Disponivel(acao?: string): boolean {
  return listarArquivosAcao(RAIZ_R2_ACAO, acao).length > 0;
}

/** Carrega ações outbound do corpus R2 local. */
export function carregarAcaoR2(opts?: {
  acao?: string;
  instanciaUuid?: string;
  limite?: number;
}): FixtureAcaoR2[] {
  let paths = listarArquivosAcao(RAIZ_R2_ACAO, opts?.acao);
  if (opts?.instanciaUuid) {
    paths = paths.filter((p) => p.startsWith(`${opts.instanciaUuid}/`));
  }
  if (opts?.limite !== undefined) {
    paths = paths.slice(0, opts.limite);
  }

  return paths.map((rel) => {
    const envelope = JSON.parse(readFileSync(join(RAIZ_R2_ACAO, rel), "utf8")) as EnvelopeAcaoR2;
    const [instanciaUuid = "", acao = ""] = rel.split("/");
    return {
      arquivo: rel,
      instanciaUuid,
      acao: envelope.acao || acao,
      envelope,
    };
  });
}
