import { acoesHandlers } from "../../handlers/acoes";
import { os } from "../../lib/os";

/** Atribui ao usuário atual as abertas sem dono. Admin/usuario. */
export default os.acoes.assumirSemDono.handler(({ context, input }) =>
  acoesHandlers.assumirSemDono(context, input),
);
