import { caixaEntradaHandlers } from "../../../handlers/inbox";
import { os } from "../../../lib/os";

export default os.caixaEntrada.etiquetas.lista.handler(({ context, input }) =>
  caixaEntradaHandlers.etiquetas.lista(context, input),
);
