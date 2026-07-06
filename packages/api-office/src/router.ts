import administracao from "./procedures/administracao";
import autenticacao from "./procedures/autenticacao";
import verificar from "./procedures/saude/verificar";
import { os } from "./lib/os";

export const router = os.router({
  saude: {
    verificar,
  },
  autenticacao,
  administracao,
});
