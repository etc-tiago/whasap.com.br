import { campanhaHandlers } from "../../handlers/campanha";
import { os } from "../../lib/os";

/** Histórico paginado de envios de campanha. */
export default os.campanha.listaEnvios.handler(({ context, input }) =>
  campanhaHandlers.listaEnvios(context, input),
);
