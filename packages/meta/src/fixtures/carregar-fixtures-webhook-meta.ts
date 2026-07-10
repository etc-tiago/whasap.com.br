import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const PASTA_FIXTURES = join(import.meta.dirname, "webhooks", "meta-cloud");

export type FixtureWebhookMeta = {
  arquivo: string;
  payload: Record<string, unknown>;
};

/** Carrega fixtures de `fixtures/webhooks/meta-cloud/*.json`. */
export function carregarFixturesWebhookMeta(): FixtureWebhookMeta[] {
  return readdirSync(PASTA_FIXTURES)
    .filter((nome) => nome.endsWith(".json"))
    .toSorted()
    .map((nomeArquivo) => ({
      arquivo: nomeArquivo,
      payload: JSON.parse(readFileSync(join(PASTA_FIXTURES, nomeArquivo), "utf8")) as Record<
        string,
        unknown
      >,
    }));
}

export function buscarFixtureWebhookMeta(nomeArquivo: string): FixtureWebhookMeta | undefined {
  return carregarFixturesWebhookMeta().find((f) => f.arquivo === nomeArquivo);
}
