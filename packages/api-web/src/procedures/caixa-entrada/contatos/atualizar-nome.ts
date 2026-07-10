import { caixaEntradaHandlers } from "../../../handlers/inbox";
import { os } from "../../../lib/os";

export default os.caixaEntrada.contatos.atualizarNome.handler(({ context, input }) =>
  caixaEntradaHandlers.contatos.atualizarNome(context, input),
);
