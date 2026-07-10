import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const PASTA_FIXTURES = join(import.meta.dirname, "respostas");

/** Recursos de `GET|POST /instance/*` com fixtures capturadas. */
export type RecursoInstanceGo = "create" | "connect" | "qr" | "status";

export type FixtureRespostaGo = {
  /** Caminho relativo, ex.: `instance/create/case-1.json`. */
  arquivo: string;
  /** Identificador do case, ex.: `case-1`. */
  caso: string;
  corpo: unknown;
};

function ordenarPorNumeroCase(a: string, b: string): number {
  const numeroA = Number(a.match(/^case-(\d+)\.json$/)?.[1] ?? 0);
  const numeroB = Number(b.match(/^case-(\d+)\.json$/)?.[1] ?? 0);
  return numeroA - numeroB;
}

/**
 * Carrega fixtures de `respostas/instance/{acao}/case-{numero}.json`.
 */
export function carregarFixturesRespostaGo(acao: RecursoInstanceGo): FixtureRespostaGo[] {
  const pasta = join(PASTA_FIXTURES, "instance", acao);

  return readdirSync(pasta)
    .filter((nome) => /^case-\d+\.json$/.test(nome))
    .toSorted(ordenarPorNumeroCase)
    .map((nomeArquivo) => {
      const arquivo = `instance/${acao}/${nomeArquivo}`;
      return {
        arquivo,
        caso: nomeArquivo.replace(/\.json$/, ""),
        corpo: JSON.parse(readFileSync(join(pasta, nomeArquivo), "utf8")) as unknown,
      };
    });
}

/** Busca fixture pelo número do case. */
export function buscarFixturePorCase(
  fixtures: FixtureRespostaGo[],
  numero: number,
): FixtureRespostaGo | undefined {
  return fixtures.find((fixture) => fixture.caso === `case-${numero}`);
}
