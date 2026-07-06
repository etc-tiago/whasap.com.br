import { instanciaHandlers } from "../../handlers/instancia";
import { os } from "../../lib/os";

export default os.instancia.lista.handler(({ context, input }) =>
  instanciaHandlers.lista(context, input),
);
