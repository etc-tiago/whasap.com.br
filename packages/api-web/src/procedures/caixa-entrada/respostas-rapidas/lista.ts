import { respostasRapidasHandlers } from "../../../handlers/respostas-rapidas";
import { os } from "../../../lib/os";

/** Lista respostas rápidas da org. Auth: membro com escrita na caixa. */
export default os.caixaEntrada.respostasRapidas.lista.handler(({ context, input }) =>
  respostasRapidasHandlers.lista(context, input),
);
