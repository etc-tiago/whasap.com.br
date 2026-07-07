import { autenticacaoHandlers } from "../../handlers/auth";
import { os } from "../../lib/os";

/** Auth office: login OTP e criação de sessão. */
export default os.autenticacao.entrar.handler(({ context, input }) =>
  autenticacaoHandlers.entrar(context, input),
);
