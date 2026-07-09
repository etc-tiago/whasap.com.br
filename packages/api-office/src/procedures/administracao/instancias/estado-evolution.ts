import { evolutionDebugHandlers } from "../../../handlers/webhooks";
import { os } from "../../../lib/os";

/** Admin: estado Evolution ao vivo vs banco para uma instância. */
export default os.administracao.instancias.estadoEvolution.handler(({ context, input }) =>
  evolutionDebugHandlers.estadoEvolution(context, input),
);
