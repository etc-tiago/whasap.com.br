import { organizacaoHandlers } from "../../../handlers/org";
import { os } from "../../../lib/os";

export default os.organizacao.membros.atualizarPapel.handler(({ context, input }) =>
  organizacaoHandlers.membros.atualizarPapel(context, input),
);
