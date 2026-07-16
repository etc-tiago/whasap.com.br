#!/usr/bin/env bun
/**
 * Recalcula `conversa.ultima_mensagem_em` / preview a partir da última mensagem
 * não excluída (MAX enviado_em). Corrige ordem e preview da inbox.
 *
 * Uso:
 *   DATABASE_URL=postgres://... bun packages/db/sync-conversa-ultima-mensagem-em.ts
 *   DATABASE_URL=... bun packages/db/sync-conversa-ultima-mensagem-em.ts --dry-run
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
      SELECT DISTINCT ON (m.conversa_id)
        m.conversa_id,
        m.enviado_em AS max_enviado_em,
        m.corpo,
        m.tipo
      FROM mensagem m
      WHERE m.excluido_em IS NULL
      ORDER BY m.conversa_id, m.enviado_em DESC, m.id DESC
    ),
    alvo AS (
      SELECT
        c.id,
        c.ultima_mensagem_em AS atual_em,
        c.ultima_mensagem_corpo AS atual_corpo,
        c.ultima_mensagem_tipo AS atual_tipo,
        u.max_enviado_em AS esperado_em,
        u.corpo AS esperado_corpo,
        u.tipo AS esperado_tipo
      FROM conversa c
      LEFT JOIN ultimas u ON u.conversa_id = c.id
      WHERE c.excluido_em IS NULL
        AND (
          c.ultima_mensagem_em IS DISTINCT FROM u.max_enviado_em
          OR c.ultima_mensagem_corpo IS DISTINCT FROM u.corpo
          OR c.ultima_mensagem_tipo IS DISTINCT FROM u.tipo
        )
    )
    SELECT
      COUNT(*)::int AS total,
      COUNT(*) FILTER (WHERE esperado_em IS NOT NULL)::int AS com_mensagem,
      COUNT(*) FILTER (WHERE esperado_em IS NULL)::int AS sem_mensagem
    FROM alvo
  `;

  const resumo = divergentes[0] ?? { total: 0, com_mensagem: 0, sem_mensagem: 0 };
  console.log(
    dryRun ? "[dry-run] Conversas a corrigir:" : "Conversas divergentes:",
    resumo.total,
    `(com mensagem: ${resumo.com_mensagem}, sem mensagem: ${resumo.sem_mensagem})`,
  );

  if (resumo.total === 0) {
    console.log("Nada a fazer — ultima_mensagem_* já alinhada com a timeline.");
    process.exit(0);
  }

  if (dryRun) {
    const amostra = await sql<{
      uuid: string;
      atual_em: Date | null;
      esperado_em: Date | null;
      atual_corpo: string | null;
      esperado_corpo: string | null;
    }[]>`
      WITH ultimas AS (
        SELECT DISTINCT ON (m.conversa_id)
          m.conversa_id,
          m.enviado_em AS max_enviado_em,
          m.corpo,
          m.tipo
        FROM mensagem m
        WHERE m.excluido_em IS NULL
        ORDER BY m.conversa_id, m.enviado_em DESC, m.id DESC
      )
      SELECT
        c.uuid,
        c.ultima_mensagem_em AS atual_em,
        u.max_enviado_em AS esperado_em,
        c.ultima_mensagem_corpo AS atual_corpo,
        u.corpo AS esperado_corpo
      FROM conversa c
      LEFT JOIN ultimas u ON u.conversa_id = c.id
      WHERE c.excluido_em IS NULL
        AND (
          c.ultima_mensagem_em IS DISTINCT FROM u.max_enviado_em
          OR c.ultima_mensagem_corpo IS DISTINCT FROM u.corpo
          OR c.ultima_mensagem_tipo IS DISTINCT FROM u.tipo
        )
      ORDER BY u.max_enviado_em DESC NULLS LAST
      LIMIT 20
    `;
    console.log("Amostra (até 20):");
    for (const row of amostra) {
      console.log(
        `  ${row.uuid}  em=${row.atual_em?.toISOString() ?? "null"}→${row.esperado_em?.toISOString() ?? "null"}  corpo=${JSON.stringify(row.atual_corpo)}→${JSON.stringify(row.esperado_corpo)}`,
      );
    }
    process.exit(0);
  }

  const atualizadas = await sql<{ id: number }[]>`
    WITH ultimas AS (
      SELECT DISTINCT ON (m.conversa_id)
        m.conversa_id,
        m.enviado_em AS max_enviado_em,
        m.corpo,
        m.tipo
      FROM mensagem m
      WHERE m.excluido_em IS NULL
      ORDER BY m.conversa_id, m.enviado_em DESC, m.id DESC
    ),
    alvo AS (
      SELECT
        c.id,
        u.max_enviado_em,
        u.corpo,
        u.tipo
      FROM conversa c
      LEFT JOIN ultimas u ON u.conversa_id = c.id
      WHERE c.excluido_em IS NULL
        AND (
          c.ultima_mensagem_em IS DISTINCT FROM u.max_enviado_em
          OR c.ultima_mensagem_corpo IS DISTINCT FROM u.corpo
          OR c.ultima_mensagem_tipo IS DISTINCT FROM u.tipo
        )
    )
    UPDATE conversa c
    SET
      ultima_mensagem_em = a.max_enviado_em,
      ultima_mensagem_corpo = a.corpo,
      ultima_mensagem_tipo = a.tipo,
      atualizado_em = NOW()
    FROM alvo a
    WHERE c.id = a.id
    RETURNING c.id
  `;

  console.log(`Atualizadas: ${atualizadas.length} conversas.`);
} finally {
  await sql.end({ timeout: 5 });
}
