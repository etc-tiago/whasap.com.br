import { campanhaHandlers } from "../../../handlers/campanha";
import { os } from "../../../lib/os";

/** Salva template Cloud memorizado para reutilização. */
export default os.campanha.templatesMemorizados.salvar.handler(({ context, input }) =>
  campanhaHandlers.templatesMemorizados.salvar(context, input),
);
