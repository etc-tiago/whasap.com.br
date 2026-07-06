import { instanciaHandlers } from "../../handlers/instancia";
import { os } from "../../lib/os";

export default os.instancia.criar.handler(({ context, input }) =>
  instanciaHandlers.criar(context, input),
);
