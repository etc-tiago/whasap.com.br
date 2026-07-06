import { caixaEntradaHandlers } from "../../../handlers/inbox";
import { os } from "../../../lib/os";

export default os.caixaEntrada.mensagens.enviar.handler(({ context, input }) =>
  caixaEntradaHandlers.mensagens.enviar(context, input),
);
