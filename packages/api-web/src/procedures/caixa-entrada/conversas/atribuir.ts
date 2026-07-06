import { caixaEntradaHandlers } from "../../../handlers/inbox";
import { os } from "../../../lib/os";

export default os.caixaEntrada.conversas.atribuir.handler(({ context, input }) =>
  caixaEntradaHandlers.conversas.atribuir(context, input),
);
