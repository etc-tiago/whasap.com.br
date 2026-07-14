export { APP_NAME, appIcons } from "./app-icons";
export {
  buildMediaR2Key,
  buildOutboundMediaR2Key,
  buildRespostaRapidaMediaR2Key,
  buildSecureInboundMediaR2Key,
  cdnMediaUrl,
  cdnMediaUrlFromDefaults,
  mimeToExtension,
} from "./cdn";
export {
  cnpjValido,
  normalizarTelefoneWhatsappBr,
  somenteDigitos,
  telefoneWhatsappBrValido,
} from "./documento-fiscal";
export {
  ICONE_CONEXAO_PADRAO,
  ICONES_CONEXAO,
  isIconeConexao,
  type IconeConexao,
} from "./icones-conexao";
export {
  calcularInvestimentoMensal,
  formatarPrecoBrl,
  type InvestimentoMensalCalculado,
  type PlanoBilling,
  type PlanoBillingId,
} from "./billing";
export { mvpDefaults } from "./mvp-defaults";
export { viteVarsProduction, workerVarsDevelopment, workerVarsProduction } from "./public-urls";
export {
  instanceProviders,
  isEvoProvider,
  isEvolutionProvider,
  isMetaCloudProvider,
  type InstanceProvider,
} from "./providers";
export {
  rotuloProvedor,
  rotuloProvedorInstancia,
  rotuloSeuWhatsApp,
  rotuloWhatsApp,
} from "./provider-labels";
