import { acoesHandlers } from "../../handlers/acoes";
import { os } from "../../lib/os";

/** Contagens do painel Ações. Requer membro da org. */
export default os.acoes.resumo.handler(({ context, input }) =>
  acoesHandlers.resumo(context, input),
);
