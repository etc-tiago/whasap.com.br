/**
 * Normaliza parâmetros de paginação com defaults do contrato ORPC.
 */
export function normalizarPaginacao(input?: { limite?: number; offset?: number }) {
  return {
    limite: input?.limite ?? 50,
    offset: input?.offset ?? 0,
  };
}
