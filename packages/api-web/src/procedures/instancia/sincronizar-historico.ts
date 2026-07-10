import { instanciaHandlers } from "../../handlers/instancia";
import { os } from "../../lib/os";

export default os.instancia.sincronizarHistorico.handler(({ context, input }) =>
  instanciaHandlers.sincronizarHistorico(context, input),
);
