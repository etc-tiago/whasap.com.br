import { caixaEntradaHandlers } from "../../../handlers/inbox";
import { os } from "../../../lib/os";

export default os.caixaEntrada.conversas.fechar.handler(({ context, input }) =>
  caixaEntradaHandlers.conversas.fechar(context, input),
);
