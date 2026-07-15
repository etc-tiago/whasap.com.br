import { caixaEntradaHandlers } from "../../../handlers/inbox";
import { os } from "../../../lib/os";

/** Contatos paginados com a etiqueta — membro da org. */
export default os.caixaEntrada.etiquetas.contatos.handler(({ context, input }) =>
  caixaEntradaHandlers.etiquetas.contatos(context, input),
);
