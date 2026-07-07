import { organizacaoHandlers } from "../../handlers/org";
import { os } from "../../lib/os";

export default os.organizacao.criar.handler(({ context, input }) =>
  organizacaoHandlers.criar(context, input),
);
