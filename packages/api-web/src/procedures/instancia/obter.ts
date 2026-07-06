import { instanciaHandlers } from "../../handlers/instancia";
import { os } from "../../lib/os";

export default os.instancia.obter.handler(({ context, input }) =>
  instanciaHandlers.obter(context, input),
);
