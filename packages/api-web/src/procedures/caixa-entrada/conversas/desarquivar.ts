import { caixaEntradaHandlers } from "../../../handlers/inbox";
import { os } from "../../../lib/os";

/** Desarquiva conversa e volta à lista principal. */
export default os.caixaEntrada.conversas.desarquivar.handler(({ context, input }) =>
  caixaEntradaHandlers.conversas.desarquivar(context, input),
);
