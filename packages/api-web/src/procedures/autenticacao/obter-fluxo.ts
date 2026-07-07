import { fluxoAutenticacaoHandlers } from "../../handlers/auth-fluxo";
import { os } from "../../lib/os";

export default os.autenticacao.obterFluxo.handler(({ context, input }) =>
  fluxoAutenticacaoHandlers.obterFluxo(context, input),
);
