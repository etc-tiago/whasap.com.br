import { campanhaHandlers } from "../../../handlers/campanha";
import { os } from "../../../lib/os";

/** Lista templates Cloud memorizados para campanha. */
export default os.campanha.templatesMemorizados.lista.handler(({ context, input }) =>
  campanhaHandlers.templatesMemorizados.lista(context, input),
);
