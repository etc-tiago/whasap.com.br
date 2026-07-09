import { webhooksHandlers } from "../../../handlers/webhooks";
import { os } from "../../../lib/os";

/** Admin: lista webhooks persistidos com paginação. */
export default os.administracao.webhooks.lista.handler(({ context, input }) =>
  webhooksHandlers.lista(context, input),
);
