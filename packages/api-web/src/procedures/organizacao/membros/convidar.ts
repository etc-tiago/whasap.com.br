import { organizacaoHandlers } from "../../../handlers/org";
import { os } from "../../../lib/os";

export default os.organizacao.membros.convidar.handler(({ context, input }) =>
  organizacaoHandlers.membros.convidar(context, input),
);
