import { acoesHandlers } from "../../handlers/acoes";
import { os } from "../../lib/os";

/** Round-robin de abertas sem dono entre admin/usuario. Admin. */
export default os.acoes.distribuirSemDono.handler(({ context, input }) =>
  acoesHandlers.distribuirSemDono(context, input),
);
