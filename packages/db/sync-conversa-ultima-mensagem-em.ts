#!/usr/bin/env bun
/**
 * Recalcula `conversa.ultima_mensagem_em` a partir do MAX(`mensagem.enviado_em`)
 * (mensagens não excluídas). Corrige ordem da caixa de entrada quando o campo
 * ficou dessincronizado da timeline real.
 *
 * Uso:
 *   DATABASE_URL=postgres://... bun scripts/sync-conversa-ultima-mensagem-em.ts
 *   DATABASE_URL=... bun scripts/sync-conversa-ultima-mensagem-em.ts --dry-run
 *
 * Ou via package.json:
 *   bun run db:sync-ultima-mensagem
 *   bun run db:sync-ultima-mensagem -- --dry-run
 */
import { criarDb } from "./src";

const dryRun = Bun.argv.includes("--dry-run");

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  console.error("Defina DATABASE_URL (ex.: no .env da raiz).");
  process.exit(1);
}

const { sql } = criarDb(databaseUrl);

try {
  const divergentes = await sql<{
    total: number;
    com_mensagem: number;
    sem_mensagem: number;
  }[]>`
    WITH ultimas AS (
      SELECT m.conversa_id, MAX(m.enviado_em) AS max_enviado_em
      FROM mensagem m
      WHERE m.excluido_em IS NULL
      GROUP BY m.conversa_id
    ),
    alvo AS (
      SELECT
        c.id,
        c.ultima_mensagem_em AS atual,
        u.max_enviado_em AS esperado
      FROM conversa c
      LEFT JOIN ultimas u ON u.conversa_id = c.id
      WHERE c.excluido_em IS NULL
        AND (c.ultima_mensagem_em IS DISTINCT FROM u.max_enviado_em)
    )
    SELECT
      COUNT(*)::int AS total,
      COUNT(*) FILTER (WHERE esperado IS NOT NULL)::int AS com_mensagem,
      COUNT(*) FILTER (WHERE esperado IS NULL)::int AS sem_mensagem
    FROM alvo
  `;

  const resumo = divergentes[0] ?? { total: 0, com_mensagem: 0, sem_mensagem: 0 };
  console.log(
    dryRun ? "[dry-run] Conversas a corrigir:" : "Conversas divergentes:",
    resumo.total,
    `(com mensagem: ${resumo.com_mensagem}, sem mensagem: ${resumo.sem_mensagem})`,
  );

  if (resumo.total === 0) {
    console.log("Nada a fazer — ultima_mensagem_em já alinhada com enviado_em.");
    process.exit(0);
  }

  if (dryRun) {
    const amostra = await sql<{
      uuid: string;
      atual: Date | null;
      esperado: Date | null;
    }[]>`
      WITH ultimas AS (
        SELECT m.conversa_id, MAX(m.enviado_em) AS max_enviado_em
        FROM mensagem m
        WHERE m.excluido_em IS NULL
        GROUP BY m.conversa_id
      )
      SELECT
        c.uuid,
        c.ultima_mensagem_em AS atual,
        u.max_enviado_em AS esperado
      FROM conversa c
      LEFT JOIN ultimas u ON u.conversa_id = c.id
      WHERE c.excluido_em IS NULL
        AND (c.ultima_mensagem_em IS DISTINCT FROM u.max_enviado_em)
      ORDER BY u.max_enviado_em DESC NULLS LAST
      LIMIT 20
    `;
    console.log("Amostra (até 20):");
    for (const row of amostra) {
      console.log(
        `  ${row.uuid}  atual=${row.atual?.toISOString() ?? "null"}  esperado=${row.esperado?.toISOString() ?? "null"}`,
      );
    }
    process.exit(0);
  }

  const atualizadas = await sql<{ id: number }[]>`
    WITH ultimas AS (
      SELECT m.conversa_id, MAX(m.enviado_em) AS max_enviado_em
      FROM mensagem m
      WHERE m.excluido_em IS NULL
      GROUP BY m.conversa_id
    ),
    alvo AS (
      SELECT c.id, u.max_enviado_em
      FROM conversa c
      LEFT JOIN ultimas u ON u.conversa_id = c.id
      WHERE c.excluido_em IS NULL
        AND (c.ultima_mensagem_em IS DISTINCT FROM u.max_enviado_em)
    )
    UPDATE conversa c
    SET
      ultima_mensagem_em = a.max_enviado_em,
      atualizado_em = NOW()
    FROM alvo a
    WHERE c.id = a.id
    RETURNING c.id
  `;

  console.log(`Atualizadas: ${atualizadas.length} conversas.`);
} finally {
  await sql.end({ timeout: 5 });
}
