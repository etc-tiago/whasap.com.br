import { organizacaoHandlers } from "../../handlers/org";
import { os } from "../../lib/os";

export default os.organizacao.lista.handler(({ context }) =>
  organizacaoHandlers.lista(context),
);
