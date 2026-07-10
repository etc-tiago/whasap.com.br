import { caixaEntradaHandlers } from "../../../handlers/inbox";
import { os } from "../../../lib/os";

export default os.caixaEntrada.etiquetas.remover.handler(({ context, input }) =>
  caixaEntradaHandlers.etiquetas.remover(context, input),
);
