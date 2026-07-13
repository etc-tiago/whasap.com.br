import autenticacao from "./procedures/autenticacao";
import acoes from "./procedures/acoes";
import caixaEntrada from "./procedures/caixa-entrada";
import instancia from "./procedures/instancia";
import organizacao from "./procedures/organizacao";
import relatorios from "./procedures/relatorios";
import verificar from "./procedures/saude/verificar";
import { os } from "./lib/os";

export const router = os.router({
  saude: {
    verificar,
  },
  autenticacao,
  organizacao,
  instancia,
  caixaEntrada,
  relatorios,
  acoes,
});
