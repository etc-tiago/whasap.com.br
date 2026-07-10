import { caixaEntradaHandlers } from "../../../handlers/inbox";
import { os } from "../../../lib/os";

export default os.caixaEntrada.etiquetas.atribuir.handler(({ context, input }) =>
  caixaEntradaHandlers.etiquetas.atribuir(context, input),
);
