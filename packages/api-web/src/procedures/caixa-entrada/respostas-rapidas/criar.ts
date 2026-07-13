import { respostasRapidasHandlers } from "../../../handlers/respostas-rapidas";
import { os } from "../../../lib/os";

/** Cria resposta rápida. Auth: membro com escrita na caixa. */
export default os.caixaEntrada.respostasRapidas.criar.handler(({ context, input }) =>
  respostasRapidasHandlers.criar(context, input),
);
