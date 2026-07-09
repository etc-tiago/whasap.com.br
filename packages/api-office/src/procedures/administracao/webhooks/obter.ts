import { webhooksHandlers } from "../../../handlers/webhooks";
import { os } from "../../../lib/os";

/** Admin: detalhe de um webhook (payload + R2). */
export default os.administracao.webhooks.obter.handler(({ context, input }) =>
  webhooksHandlers.obter(context, input),
);
