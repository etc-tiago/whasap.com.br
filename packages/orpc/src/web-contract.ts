import { autenticacaoContract } from "./contracts/web/autenticacao";
import { caixaEntradaContract } from "./contracts/web/caixa-entrada";
import { instanciaContract } from "./contracts/web/instancia";
import { organizacaoContract } from "./contracts/web/organizacao";
import { relatoriosContract } from "./contracts/web/relatorios";
import { saudeContract } from "./contracts/web/saude";

export const webContract = {
  saude: saudeContract,
  autenticacao: autenticacaoContract,
  organizacao: organizacaoContract,
  instancia: instanciaContract,
  caixaEntrada: caixaEntradaContract,
  relatorios: relatoriosContract,
};

export type WebContract = typeof webContract;
