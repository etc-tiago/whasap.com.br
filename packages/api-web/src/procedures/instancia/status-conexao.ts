import { instanciaHandlers } from "../../handlers/instancia";
import { os } from "../../lib/os";

export default os.instancia.statusConexao.handler(({ context, input }) =>
  instanciaHandlers.statusConexao(context, input),
);
