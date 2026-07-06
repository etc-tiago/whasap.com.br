import { organizacaoHandlers } from "../../../handlers/org";
import { os } from "../../../lib/os";

export default os.organizacao.membros.desativar.handler(({ context, input }) =>
  organizacaoHandlers.membros.desativar(context, input),
);
