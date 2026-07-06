import { caixaEntradaHandlers } from "../../../handlers/inbox";
import { os } from "../../../lib/os";

export default os.caixaEntrada.templates.lista.handler(({ context, input }) =>
  caixaEntradaHandlers.templates.lista(context, input),
);
