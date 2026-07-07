import { administracaoHandlers } from "../../../handlers/administracao";
import { os } from "../../../lib/os";

/** Admin: detalhe de instância por `instanciaId` (auth office). */
export default os.administracao.instancias.obter.handler(({ context, input }) =>
  administracaoHandlers.obterInstancia(context, input),
);
