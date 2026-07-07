import { autenticacaoHandlers } from "../../handlers/auth";
import { os } from "../../lib/os";

/** Auth office: retorna sessão do usuário autenticado. */
export default os.autenticacao.eu.handler(({ context }) => autenticacaoHandlers.eu(context));
