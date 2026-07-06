import { autenticacaoHandlers } from "../../handlers/auth";
import { os } from "../../lib/os";

export default os.autenticacao.entrar.handler(({ context, input }) =>
  autenticacaoHandlers.entrar(context, input),
);
