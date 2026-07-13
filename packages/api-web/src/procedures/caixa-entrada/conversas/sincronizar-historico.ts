/** Sync on-demand do histórico de uma conversa (Evolution). Auth: sessão. */
import { caixaEntradaHandlers } from "../../../handlers/inbox";
import { os } from "../../../lib/os";

export default os.caixaEntrada.conversas.sincronizarHistorico.handler(({ context, input }) =>
  caixaEntradaHandlers.conversas.sincronizarHistorico(context, input),
);
