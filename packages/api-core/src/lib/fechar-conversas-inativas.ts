import { comTimestampAtualizacao, conversa, instancia, organizacao, type Db } from "@whasap/db";
import { and, eq, inArray, isNull, lt, or } from "drizzle-orm";

/** Limite temporal para conversas inativas (ultimaMensagemEm ou criadoEm). */
export function limiteInatividadeConversa(horas: number): Date {
  return new Date(Date.now() - horas * 60 * 60 * 1000);
}

/**
 * Filtro Drizzle: conversas abertas inativas nas instâncias dadas.
 * Inativa = sem mensagem desde `limite`, usando `ultimaMensagemEm` ou `criadoEm`.
 */
export function filtroConversasInativas(instanceIds: number[], limite: Date) {
  return and(
    inArray(conversa.instanciaId, instanceIds),
    eq(conversa.status, "open"),
    isNull(conversa.excluidoEm),
    or(
      and(isNull(conversa.ultimaMensagemEm), lt(conversa.criadoEm, limite)),
      lt(conversa.ultimaMensagemEm, limite),
    ),
  );
}

/**
 * Fecha conversas abertas inativas de todas as organizações (cron).
 * Threshold por org: `horasAutoFecharInatividade` (default 72).
 * Agrupa orgs pelo mesmo threshold para evitar await em loop por org.
 */
export async function fecharConversasInativasGlobal(
  db: Db,
): Promise<{ orgs: number; afetadas: number }> {
  const orgs = await db.query.organizacao.findMany({
    where: isNull(organizacao.excluidoEm),
    columns: { id: true, horasAutoFecharInatividade: true },
  });

  if (orgs.length === 0) return { orgs: 0, afetadas: 0 };

  const porHoras = new Map<number, number[]>();
  for (const org of orgs) {
    const horas = Number.parseInt(org.horasAutoFecharInatividade ?? "72", 10) || 72;
    const lista = porHoras.get(horas) ?? [];
    lista.push(org.id);
    porHoras.set(horas, lista);
  }

  const now = new Date();
  const resultados = await Promise.all(
    [...porHoras.entries()].map(async ([horas, orgIds]) => {
      const limite = limiteInatividadeConversa(horas);
      const instances = await db
        .select({ id: instancia.id })
        .from(instancia)
        .where(and(inArray(instancia.organizacaoId, orgIds), isNull(instancia.excluidoEm)));
      if (instances.length === 0) return 0;

      const instanceIds = instances.map((i) => i.id);
      const rows = await db
        .update(conversa)
        .set(comTimestampAtualizacao({ status: "closed", fechadoEm: now }))
        .where(filtroConversasInativas(instanceIds, limite))
        .returning({ id: conversa.id });
      return rows.length;
    }),
  );

  return {
    orgs: orgs.length,
    afetadas: resultados.reduce((a, b) => a + b, 0),
  };
}
