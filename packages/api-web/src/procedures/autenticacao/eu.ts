import { autenticacaoHandlers } from "../../handlers/auth";
import { os } from "../../lib/os";

export default os.autenticacao.eu.handler(({ context }) =>
  autenticacaoHandlers.eu(context),
);
