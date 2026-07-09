import { instanciaHandlers } from "../../handlers/instancia";
import { os } from "../../lib/os";

export default os.instancia.encerrarPareamento.handler(({ context, input }) =>
  instanciaHandlers.encerrarPareamento(context, input),
);
