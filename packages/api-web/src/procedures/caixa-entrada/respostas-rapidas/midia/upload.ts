import { respostasRapidasHandlers } from "../../../../handlers/respostas-rapidas";
import { os } from "../../../../lib/os";

/** Upload de mídia org-scoped para respostas rápidas. Auth: escrita na caixa. */
export default os.caixaEntrada.respostasRapidas.midia.upload.handler(({ context, input }) =>
  respostasRapidasHandlers.midia.upload(context, input),
);
