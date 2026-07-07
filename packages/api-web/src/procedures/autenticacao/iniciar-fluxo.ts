import { fluxoAutenticacaoHandlers } from "../../handlers/auth-fluxo";
import { os } from "../../lib/os";

export default os.autenticacao.iniciarFluxo.handler(({ context, input }) =>
  fluxoAutenticacaoHandlers.iniciarFluxo(context, input),
);
