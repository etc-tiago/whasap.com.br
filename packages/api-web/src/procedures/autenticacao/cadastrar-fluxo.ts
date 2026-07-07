import { fluxoAutenticacaoHandlers } from "../../handlers/auth-fluxo";
import { os } from "../../lib/os";

export default os.autenticacao.cadastrarFluxo.handler(({ context, input }) =>
  fluxoAutenticacaoHandlers.cadastrarFluxo(context, input),
);
