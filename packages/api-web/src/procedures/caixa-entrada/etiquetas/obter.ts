import { caixaEntradaHandlers } from "../../../handlers/inbox";
import { os } from "../../../lib/os";

/** Detalhe da etiqueta (gestão) — membro da org. */
export default os.caixaEntrada.etiquetas.obter.handler(({ context, input }) =>
  caixaEntradaHandlers.etiquetas.obter(context, input),
);
