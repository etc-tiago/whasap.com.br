import { autenticacaoHandlers } from "../../handlers/auth";
import { os } from "../../lib/os";

export default os.autenticacao.sair.handler(({ context }) => autenticacaoHandlers.sair(context));
