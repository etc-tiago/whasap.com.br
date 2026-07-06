import { organizacaoHandlers } from "../../handlers/org";
import { os } from "../../lib/os";

export default os.organizacao.trocar.handler(({ context, input }) =>
  organizacaoHandlers.trocar(context, input),
);
