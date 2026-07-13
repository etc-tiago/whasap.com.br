import { caixaEntradaHandlers } from "../../../handlers/inbox";
import { os } from "../../../lib/os";

/** Soft-delete do contato. */
export default os.caixaEntrada.contatos.remover.handler(({ context, input }) =>
  caixaEntradaHandlers.contatos.remover(context, input),
);
