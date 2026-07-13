import { respostasRapidasHandlers } from "../../../handlers/respostas-rapidas";
import { os } from "../../../lib/os";

/** Atualiza resposta rápida. Auth: membro com escrita na caixa. */
export default os.caixaEntrada.respostasRapidas.atualizar.handler(({ context, input }) =>
  respostasRapidasHandlers.atualizar(context, input),
);
