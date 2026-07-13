import { acoesHandlers } from "../../handlers/acoes";
import { os } from "../../lib/os";

/** Remove atribuição das conversas do usuário atual. Admin/usuario. */
export default os.acoes.liberarMinhas.handler(({ context, input }) =>
  acoesHandlers.liberarMinhas(context, input),
);
