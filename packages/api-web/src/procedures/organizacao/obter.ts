import { organizacaoHandlers } from "../../handlers/org";
import { os } from "../../lib/os";

export default os.organizacao.obter.handler(({ context, input }) =>
  organizacaoHandlers.obter(context, input),
);
