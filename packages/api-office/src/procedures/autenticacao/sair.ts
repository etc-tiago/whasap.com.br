import { autenticacaoHandlers } from "../../handlers/auth";
import { os } from "../../lib/os";

/** Auth office: encerra sessão. */
export default os.autenticacao.sair.handler(({ context }) => autenticacaoHandlers.sair(context));
