import { caixaEntradaHandlers } from "../../../handlers/inbox";
import { os } from "../../../lib/os";

export default os.caixaEntrada.templates.sincronizar.handler(({ context, input }) =>
  caixaEntradaHandlers.templates.sincronizar(context, input),
);
