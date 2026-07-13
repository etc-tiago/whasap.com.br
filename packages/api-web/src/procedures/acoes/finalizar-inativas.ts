import { acoesHandlers } from "../../handlers/acoes";
import { os } from "../../lib/os";

/** Fecha conversas inativas conforme threshold da org. Admin. */
export default os.acoes.finalizarInativas.handler(({ context, input }) =>
  acoesHandlers.finalizarInativas(context, input),
);
