import { autenticacaoHandlers } from "../../handlers/auth";
import { os } from "../../lib/os";

export default os.autenticacao.enviarOtp.handler(({ context, input }) =>
  autenticacaoHandlers.enviarOtp(context, input),
);
