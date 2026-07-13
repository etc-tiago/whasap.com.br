import { acoesHandlers } from "../../handlers/acoes";
import { os } from "../../lib/os";

/** Zera não lidas das conversas abertas. Admin. */
export default os.acoes.marcarTodasLidas.handler(({ context, input }) =>
  acoesHandlers.marcarTodasLidas(context, input),
);
