import { unauthorized } from "@whasap/api-core";

import type { OfficeContext } from "../types";

/**
 * Garante que a requisição tem sessão office válida.
 * @throws 401 se `ctx.officeUsuario` estiver ausente.
 */
export function exigirAutenticacaoOffice(ctx: OfficeContext) {
  if (!ctx.officeUsuario) {
    unauthorized("Não autenticado");
  }
  return ctx.officeUsuario;
}

/**
 * Monta resposta de sessão office para `autenticacao.eu` e `autenticacao.entrar`.
 */
export function mapearSessaoOfficeParaSaida(ctx: OfficeContext) {
  const usuario = exigirAutenticacaoOffice(ctx);
  return {
    usuario: {
      id: usuario.id,
      email: usuario.email,
      nome: usuario.nome,
    },
  };
}
