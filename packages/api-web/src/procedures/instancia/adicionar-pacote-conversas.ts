import { instanciaHandlers } from "../../handlers/instancia";
import { os } from "../../lib/os";

export default os.instancia.adicionarPacoteConversas.handler(({ context, input }) =>
  instanciaHandlers.adicionarPacoteConversas(context, input),
);
