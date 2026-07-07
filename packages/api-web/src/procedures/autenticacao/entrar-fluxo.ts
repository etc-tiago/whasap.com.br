import { fluxoAutenticacaoHandlers } from "../../handlers/auth-fluxo";
import { os } from "../../lib/os";

export default os.autenticacao.entrarFluxo.handler(({ context, input }) =>
  fluxoAutenticacaoHandlers.entrarFluxo(context, input),
);
