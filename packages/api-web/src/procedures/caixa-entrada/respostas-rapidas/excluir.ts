import { respostasRapidasHandlers } from "../../../handlers/respostas-rapidas";
import { os } from "../../../lib/os";

/** Soft-delete de resposta rápida. Auth: membro com escrita na caixa. */
export default os.caixaEntrada.respostasRapidas.excluir.handler(({ context, input }) =>
  respostasRapidasHandlers.excluir(context, input),
);
