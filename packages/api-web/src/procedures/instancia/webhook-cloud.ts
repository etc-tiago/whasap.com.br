import { instanciaHandlers } from "../../handlers/instancia";
import { os } from "../../lib/os";

/** `instancia.webhookCloud` — callback URL e verify token (= UUID da conexão). */
export default os.instancia.webhookCloud.handler(({ context, input }) =>
  instanciaHandlers.webhookCloud(context, input),
);
