/**
 * Filtro para `where` em `db.query.*` e relações `with:`.
 * Oculta registros com exclusão lógica (`excluidoEm` preenchido).
 *
 * @returns Condição Drizzle `isNull(excluidoEm)`.
 */
export function filtroNaoExcluido<T extends { excluidoEm: unknown }>(
  registro: T,
  operadores: { isNull: (col: T["excluidoEm"]) => unknown },
) {
  return operadores.isNull(registro.excluidoEm);
}
