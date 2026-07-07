import { administracaoHandlers } from "../../../handlers/administracao";
import { os } from "../../../lib/os";

/** Admin: lista instâncias (auth office). Filtro opcional por `organizacaoHash`. */
export default os.administracao.instancias.lista.handler(({ context, input }) =>
  administracaoHandlers.listarInstancias(context, input),
);
