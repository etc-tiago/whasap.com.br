import { fluxoAutenticacaoHandlers } from "../../handlers/auth-fluxo";
import { os } from "../../lib/os";

/** ORPC `entrarFluxo`: wiring apenas — lógica em `handlers/auth-fluxo.ts`. Ver `packages/api-web/README.md`. */
export default os.autenticacao.entrarFluxo.handler(({ context, input }) =>
  fluxoAutenticacaoHandlers.entrarFluxo(context, input),
);
