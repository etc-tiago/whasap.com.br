import { campanhaHandlers } from "../../handlers/campanha";
import { os } from "../../lib/os";

/** Contagens do dia/hora do módulo de campanha. */
export default os.campanha.resumo.handler(({ context, input }) =>
  campanhaHandlers.resumo(context, input),
);
