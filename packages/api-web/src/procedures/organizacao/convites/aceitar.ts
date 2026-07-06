import { organizacaoHandlers } from "../../../handlers/org";
import { os } from "../../../lib/os";

export default os.organizacao.convites.aceitar.handler(({ context, input }) =>
  organizacaoHandlers.convites.aceitar(context, input),
);
