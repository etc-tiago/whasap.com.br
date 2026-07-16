import { caixaEntradaHandlers } from "../../../handlers/inbox";
import { os } from "../../../lib/os";

/** Arquiva conversa localmente no painel. */
export default os.caixaEntrada.conversas.arquivar.handler(({ context, input }) =>
  caixaEntradaHandlers.conversas.arquivar(context, input),
);
