import { caixaEntradaHandlers } from "../../../handlers/inbox";
import { os } from "../../../lib/os";

export default os.caixaEntrada.etiquetas.porContato.handler(({ context, input }) =>
  caixaEntradaHandlers.etiquetas.porContato(context, input),
);
