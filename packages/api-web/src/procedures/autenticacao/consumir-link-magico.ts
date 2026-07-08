import { fluxoAutenticacaoHandlers } from "../../handlers/auth-fluxo";
import { os } from "../../lib/os";

export default os.autenticacao.consumirLinkMagico.handler(({ context, input }) =>
  fluxoAutenticacaoHandlers.consumirLinkMagico(context, input),
);
