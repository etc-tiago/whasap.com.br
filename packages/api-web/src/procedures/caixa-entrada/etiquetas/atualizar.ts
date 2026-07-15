import { caixaEntradaHandlers } from "../../../handlers/inbox";
import { os } from "../../../lib/os";

/** Atualiza nome/cor da etiqueta — admin/usuario. */
export default os.caixaEntrada.etiquetas.atualizar.handler(({ context, input }) =>
  caixaEntradaHandlers.etiquetas.atualizar(context, input),
);
