import { campanhaHandlers } from "../../handlers/campanha";
import { os } from "../../lib/os";

/** Envio imediato de campanha. Requer módulo habilitado e permissão de envio. */
export default os.campanha.enviar.handler(({ context, input }) =>
  campanhaHandlers.enviar(context, input),
);
