import { caixaEntradaHandlers } from "../../../handlers/inbox";
import { os } from "../../../lib/os";

export default os.caixaEntrada.mensagens.enviarTemplate.handler(({ context, input }) =>
  caixaEntradaHandlers.mensagens.enviarTemplate(context, input),
);
