import { caixaEntradaHandlers } from "../../../handlers/inbox";
import { os } from "../../../lib/os";

/** Contatos da organização com paginação, instâncias e conversa aberta. */
export default os.caixaEntrada.contatos.lista.handler(({ context, input }) =>
  caixaEntradaHandlers.contatos.lista(context, input),
);
