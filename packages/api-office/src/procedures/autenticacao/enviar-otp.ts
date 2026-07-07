import { autenticacaoHandlers } from "../../handlers/auth";
import { os } from "../../lib/os";

/** Auth office: envia OTP por e-mail (usuários pré-cadastrados). */
export default os.autenticacao.enviarOtp.handler(({ context, input }) =>
  autenticacaoHandlers.enviarOtp(context, input),
);
