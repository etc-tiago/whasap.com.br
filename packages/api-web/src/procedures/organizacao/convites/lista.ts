import { organizacaoHandlers } from "../../../handlers/org";
import { os } from "../../../lib/os";

export default os.organizacao.convites.lista.handler(({ context, input }) =>
  organizacaoHandlers.convites.lista(context, input),
);
