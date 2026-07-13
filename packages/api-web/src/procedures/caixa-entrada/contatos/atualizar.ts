import { caixaEntradaHandlers } from "../../../handlers/inbox";
import { os } from "../../../lib/os";

/** Atualiza o nome do contato. */
export default os.caixaEntrada.contatos.atualizar.handler(({ context, input }) =>
  caixaEntradaHandlers.contatos.atualizar(context, input),
);
