import { autenticacaoHandlers } from "../../handlers/auth";
import { os } from "../../lib/os";

/** Heartbeat do painel — atualiza última atividade (auth obrigatória). */
export default os.autenticacao.registrarAtividade.handler(({ context }) =>
  autenticacaoHandlers.registrarAtividade(context),
);
