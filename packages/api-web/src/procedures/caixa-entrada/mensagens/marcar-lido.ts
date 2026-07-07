import { caixaEntradaHandlers } from "../../../handlers/inbox";
import { os } from "../../../lib/os";

/** Marca mensagem inbound como lida no provedor (Cloud API / Evolution GO). */
export default os.caixaEntrada.mensagens.marcarLido.handler(({ context, input }) =>
  caixaEntradaHandlers.mensagens.marcarLido(context, input),
);
