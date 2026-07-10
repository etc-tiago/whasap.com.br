import { caixaEntradaHandlers } from "../../../handlers/inbox";
import { os } from "../../../lib/os";

export default os.caixaEntrada.etiquetas.criar.handler(({ context, input }) =>
  caixaEntradaHandlers.etiquetas.criar(context, input),
);
