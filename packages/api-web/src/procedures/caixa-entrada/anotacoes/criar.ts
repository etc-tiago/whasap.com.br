import { caixaEntradaHandlers } from "../../../handlers/inbox";
import { os } from "../../../lib/os";

export default os.caixaEntrada.anotacoes.criar.handler(({ context, input }) =>
  caixaEntradaHandlers.anotacoes.criar(context, input),
);
