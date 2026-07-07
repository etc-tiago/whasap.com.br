import { administracaoHandlers } from "../../../handlers/administracao";
import { os } from "../../../lib/os";

/** Admin: lista organizações paginadas (auth office). */
export default os.administracao.organizacoes.lista.handler(({ context, input }) =>
  administracaoHandlers.listarOrganizacoes(context, input),
);
