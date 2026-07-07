/**
 * Monta payload de insert com `criadoEm` e `atualizadoEm` preenchidos.
 * @returns Objeto pronto para `db.insert(tabela).values(...)`.
 */
export function comTimestampsCriacao<T extends object>(dados: T) {
  const agora = new Date();
  return { ...dados, criadoEm: agora, atualizadoEm: agora };
}

/**
 * Monta payload de update com `atualizadoEm` preenchido.
 * @returns Objeto pronto para `db.update(tabela).set(...)`.
 */
export function comTimestampAtualizacao<T extends object>(dados: T) {
  return { ...dados, atualizadoEm: new Date() };
}

/**
 * Marca exclusão lógica de um registro.
 * @returns `{ excluidoEm: Date }` para `db.update(tabela).set(...)`.
 */
export function marcarExclusaoLogica() {
  return { excluidoEm: new Date() };
}

/**
 * Monta payload de insert para tabelas que só têm `criadoEm`.
 * @returns Objeto com `criadoEm` preenchido.
 */
export function comCriadoEm<T extends object>(dados: T) {
  return { ...dados, criadoEm: new Date() };
}
