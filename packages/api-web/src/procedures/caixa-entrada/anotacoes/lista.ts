import { caixaEntradaHandlers } from "../../../handlers/inbox";
import { os } from "../../../lib/os";

export default os.caixaEntrada.anotacoes.lista.handler(({ context, input }) =>
  caixaEntradaHandlers.anotacoes.lista(context, input),
);
