import { caixaEntradaHandlers } from "../../../handlers/inbox";
import { os } from "../../../lib/os";

export default os.caixaEntrada.conversas.iniciar.handler(({ context, input }) =>
  caixaEntradaHandlers.conversas.iniciar(context, input),
);
