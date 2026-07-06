import { officeAdministracaoContract } from "./contracts/office/administracao";
import { officeAutenticacaoContract } from "./contracts/office/autenticacao";
import { saudeContract } from "./contracts/web/saude";

export const officeContract = {
  saude: saudeContract,
  autenticacao: officeAutenticacaoContract,
  administracao: officeAdministracaoContract,
};

export type OfficeContract = typeof officeContract;
