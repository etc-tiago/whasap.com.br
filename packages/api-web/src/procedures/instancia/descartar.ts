import { instanciaHandlers } from "../../handlers/instancia";
import { os } from "../../lib/os";

/** Descarta instância em onboarding (admin). Remove Evolution e soft-delete. */
export default os.instancia.descartar.handler(({ context, input }) =>
  instanciaHandlers.descartar(context, input),
);
