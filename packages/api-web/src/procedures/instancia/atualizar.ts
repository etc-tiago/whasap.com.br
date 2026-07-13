import { instanciaHandlers } from "../../handlers/instancia";
import { os } from "../../lib/os";

export default os.instancia.atualizar.handler(({ context, input }) =>
  instanciaHandlers.atualizar(context, input),
);
