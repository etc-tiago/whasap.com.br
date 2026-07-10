import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const PASTA_FIXTURES = join(import.meta.dirname, "webhooks", "evo");

export type FixtureWebhookGo = {
  arquivo: string;
  envelope: { receivedAt: string; meta: Record<string, string>; raw: string };
  payload: Record<string, unknown>;
};

/** Carrega fixtures de `fixtures/webhooks/evo/*.json`. */
export function carregarFixturesWebhookGo(): FixtureWebhookGo[] {
  return readdirSync(PASTA_FIXTURES)
    .filter((nome) => nome.endsWith(".json"))
    .sort()
    .map((nomeArquivo) => {
      const envelope = JSON.parse(readFileSync(join(PASTA_FIXTURES, nomeArquivo), "utf8")) as {
        receivedAt: string;
        meta: Record<string, string>;
        raw: string;
      };
      return {
        arquivo: nomeArquivo,
        envelope,
        payload: JSON.parse(envelope.raw) as Record<string, unknown>,
      };
    });
}

export function buscarFixtureWebhookGo(nomeArquivo: string): FixtureWebhookGo | undefined {
  return carregarFixturesWebhookGo().find((f) => f.arquivo === nomeArquivo);
}
