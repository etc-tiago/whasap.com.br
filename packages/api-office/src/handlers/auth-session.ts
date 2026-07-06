import { unauthorized } from "@whasap/api-core";

import type { OfficeContext } from "../types";

export function requireOfficeAuth(ctx: OfficeContext) {
  if (!ctx.officeUsuario) {
    unauthorized("Não autenticado");
  }
  return ctx.officeUsuario;
}

export function toOfficeSessionOutput(ctx: OfficeContext) {
  const usuario = requireOfficeAuth(ctx);
  return {
    usuario: {
      id: usuario.id,
      email: usuario.email,
      nome: usuario.nome,
    },
  };
}
