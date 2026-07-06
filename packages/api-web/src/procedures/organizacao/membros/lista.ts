import { organizacaoHandlers } from "../../../handlers/org";
import { os } from "../../../lib/os";

export default os.organizacao.membros.lista.handler(({ context, input }) =>
  organizacaoHandlers.membros.lista(context, input),
);
