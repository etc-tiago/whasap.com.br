import { instanciaHandlers } from "../../handlers/instancia";
import { os } from "../../lib/os";

export default os.instancia.obterQr.handler(({ context, input }) =>
  instanciaHandlers.obterQr(context, input),
);
