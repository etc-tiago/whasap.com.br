import { caixaEntradaHandlers } from "../../../handlers/inbox";
import { os } from "../../../lib/os";

export default os.caixaEntrada.mensagens.lista.handler(({ context, input }) =>
  caixaEntradaHandlers.mensagens.lista(context, input),
);
