import { acoesHandlers } from "../../handlers/acoes";
import { os } from "../../lib/os";

/** Fecha todas as conversas abertas. Admin. */
export default os.acoes.finalizarTodas.handler(({ context, input }) =>
  acoesHandlers.finalizarTodas(context, input),
);
