import { instanciaHandlers } from "../../handlers/instancia";
import { os } from "../../lib/os";

/** Desconecta WhatsApp; opcionalmente exclui dados e remove a conexão do painel. */
export default os.instancia.desconectar.handler(({ context, input }) =>
  instanciaHandlers.desconectar(context, input),
);
