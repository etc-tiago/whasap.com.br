/**
 * Loader generico de webhooks Evolution no corpus R2 (qualquer evento).
 */
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const RAIZ_R2_EVO = join(import.meta.dirname, "../../../r2-sync/json/webhook/evo");

export type FixtureWebhookR2 = {
  arquivo: string;
  instanciaPasta: string;
  event: string;
  payload: Record<string, unknown>;
  data: Record<string, unknown>;
};

function listarArquivos(raiz: string, prefixoEvento?: string): string[] {
  if (!existsSync(raiz)) return [];
  const out: string[] = [];
  for (const instanciaPasta of readdirSync(raiz)) {
    const dirInst = join(raiz, instanciaPasta);
    if (!statSync(dirInst).isDirectory()) continue;
    for (const dia of readdirSync(dirInst)) {
      const dirDia = join(dirInst, dia);
      if (!statSync(dirDia).isDirectory()) continue;
      for (const nome of readdirSync(dirDia)) {
        if (!nome.endsWith(".json")) continue;
        if (prefixoEvento && !nome.startsWith(`${prefixoEvento}-`)) continue;
        out.push(join(instanciaPasta, dia, nome));
      }
    }
  }
  return out.toSorted();
}

export function corpusWebhookR2Disponivel(): boolean {
  return listarArquivos(RAIZ_R2_EVO).length > 0;
}

export function carregarWebhooksR2(opts?: {
  evento?: string;
  instanciaPasta?: string;
  limite?: number;
}): FixtureWebhookR2[] {
  let paths = listarArquivos(RAIZ_R2_EVO, opts?.evento);
  if (opts?.instanciaPasta) {
    paths = paths.filter((p) => p.startsWith(`${opts.instanciaPasta}/`));
  }
  if (opts?.limite !== undefined) paths = paths.slice(0, opts.limite);

  return paths.map((rel) => {
    const envelope = JSON.parse(readFileSync(join(RAIZ_R2_EVO, rel), "utf8")) as {
      raw: string;
    };
    const payload = JSON.parse(envelope.raw) as Record<string, unknown>;
    return {
      arquivo: rel,
      instanciaPasta: rel.split("/")[0]!,
      event: String(payload.event ?? ""),
      payload,
      data: (payload.data ?? {}) as Record<string, unknown>,
    };
  });
}
