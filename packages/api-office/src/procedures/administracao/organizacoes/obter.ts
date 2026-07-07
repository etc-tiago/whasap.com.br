import { administracaoHandlers } from "../../../handlers/administracao";
import { os } from "../../../lib/os";

/** Admin: detalhe de organização por `organizacaoHash` (auth office). */
export default os.administracao.organizacoes.obter.handler(({ context, input }) =>
  administracaoHandlers.obterOrganizacao(context, input),
);
