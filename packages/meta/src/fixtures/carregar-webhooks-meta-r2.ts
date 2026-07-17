/**
 * Loader de webhooks Meta Cloud no corpus R2 (`packages/r2-sync/json/webhook/cloud`).
 */
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const RAIZ_R2_CLOUD = join(import.meta.dirname, "../../../r2-sync/json/webhook/cloud");

export type FixtureWebhookMetaR2 = {
  arquivo: string;
  phoneNumberIdPasta: string;
  envelope: { receivedAt: string; meta: Record<string, string>; raw: string };
  payload: Record<string, unknown>;
};

function listarArquivos(raiz: string): string[] {
  if (!existsSync(raiz)) return [];
  const out: string[] = [];
  for (const phonePasta of readdirSync(raiz)) {
    const dirPhone = join(raiz, phonePasta);
    if (!statSync(dirPhone).isDirectory()) continue;
    for (const dia of readdirSync(dirPhone)) {
      const dirDia = join(dirPhone, dia);
      if (!statSync(dirDia).isDirectory()) continue;
      for (const nome of readdirSync(dirDia)) {
        if (!nome.endsWith(".json")) continue;
        out.push(join(phonePasta, dia, nome));
      }
    }
  }
  return out.toSorted();
}

export function corpusWebhookMetaR2Disponivel(): boolean {
  return listarArquivos(RAIZ_R2_CLOUD).length > 0;
}

export function carregarWebhooksMetaR2(opts?: { limite?: number }): FixtureWebhookMetaR2[] {
  let paths = listarArquivos(RAIZ_R2_CLOUD);
  if (opts?.limite !== undefined) paths = paths.slice(0, opts.limite);

  return paths.map((rel) => {
    const envelope = JSON.parse(readFileSync(join(RAIZ_R2_CLOUD, rel), "utf8")) as {
      receivedAt: string;
      meta: Record<string, string>;
      raw: string;
    };
    const payload = JSON.parse(envelope.raw) as Record<string, unknown>;
    return {
      arquivo: rel,
      phoneNumberIdPasta: rel.split("/")[0]!,
      envelope,
      payload,
    };
  });
}
