import { instanciaHandlers } from "../../handlers/instancia";
import { os } from "../../lib/os";

export default os.instancia.criarCheckout.handler(({ context, input }) =>
  instanciaHandlers.criarCheckout(context, input),
);
