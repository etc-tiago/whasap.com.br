import { autenticacaoHandlers } from "../../handlers/auth";
import { os } from "../../lib/os";

export default os.autenticacao.cadastrar.handler(({ context, input }) =>
  autenticacaoHandlers.cadastrar(context, input),
);
