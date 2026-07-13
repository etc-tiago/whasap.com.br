import { caixaEntradaHandlers } from "../../../handlers/inbox";
import { os } from "../../../lib/os";

/** Cria ou reaproveita contato e vínculo com a instância. */
export default os.caixaEntrada.contatos.criar.handler(({ context, input }) =>
  caixaEntradaHandlers.contatos.criar(context, input),
);
