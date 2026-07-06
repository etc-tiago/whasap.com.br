import { caixaEntradaHandlers } from "../../../handlers/inbox";
import { os } from "../../../lib/os";

export default os.caixaEntrada.conversas.lista.handler(({ context, input }) =>
  caixaEntradaHandlers.conversas.lista(context, input),
);
