import { autenticacaoHandlers } from "../../handlers/auth";
import { os } from "../../lib/os";

/** Atualiza dados da conta do usuário autenticado. */
export default os.autenticacao.atualizar.handler(({ context, input }) =>
  autenticacaoHandlers.atualizar(context, input),
);
