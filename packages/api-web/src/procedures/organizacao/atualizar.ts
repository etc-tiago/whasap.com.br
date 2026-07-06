import { organizacaoHandlers } from "../../handlers/org";
import { os } from "../../lib/os";

export default os.organizacao.atualizar.handler(({ context, input }) =>
  organizacaoHandlers.atualizar(context, input),
);
