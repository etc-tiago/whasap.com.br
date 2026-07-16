import { caixaEntradaHandlers } from "../../../handlers/inbox";
import { os } from "../../../lib/os";

/** Soft-delete da mensagem; tenta revoke no Evolution quando outbound. */
export default os.caixaEntrada.mensagens.excluir.handler(({ context, input }) =>
  caixaEntradaHandlers.mensagens.excluir(context, input),
);
