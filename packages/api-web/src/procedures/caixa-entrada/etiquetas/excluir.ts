import { caixaEntradaHandlers } from "../../../handlers/inbox";
import { os } from "../../../lib/os";

/** Exclui a etiqueta e atribuições — admin/usuario. */
export default os.caixaEntrada.etiquetas.excluir.handler(({ context, input }) =>
  caixaEntradaHandlers.etiquetas.excluir(context, input),
);
