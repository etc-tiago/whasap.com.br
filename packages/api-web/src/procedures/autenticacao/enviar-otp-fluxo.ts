import { fluxoAutenticacaoHandlers } from "../../handlers/auth-fluxo";
import { os } from "../../lib/os";

export default os.autenticacao.enviarOtpFluxo.handler(({ context, input }) =>
  fluxoAutenticacaoHandlers.enviarOtpFluxo(context, input),
);
