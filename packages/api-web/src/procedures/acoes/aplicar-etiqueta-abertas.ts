import { acoesHandlers } from "../../handlers/acoes";
import { os } from "../../lib/os";

/** Aplica etiqueta aos contatos das conversas abertas. Admin. */
export default os.acoes.aplicarEtiquetaAbertas.handler(({ context, input }) =>
  acoesHandlers.aplicarEtiquetaAbertas(context, input),
);
