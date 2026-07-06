import autenticacao from "./procedures/autenticacao";
import caixaEntrada from "./procedures/caixa-entrada";
import cobranca from "./procedures/cobranca";
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
  cobranca,
  caixaEntrada,
  relatorios,
});
