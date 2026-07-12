export {
  atribuirSessaoRpc,
  createRpcHandler,
  createSessionCookieHelpers,
  emitirJwtSessao,
  limparSessaoRpc,
  verificarJwtSessao,
  type EstadoSessaoRpc,
  type RpcSessionConfig,
  type SessionJwtAudience,
} from "./create-rpc-handler";
export { beginAuthAttempt, failAuthAttemptWithCode } from "./lib/auth-rate-limit";
export { sendInviteEmail, sendOtpEmail } from "./lib/email";
export {
  contarOtpsRecentes,
  assertOtpSendAllowed,
  criarOtp,
  normalizarOtp,
  slugify,
  verificarOtp,
} from "./lib/otp";
export { derivarNomeDoEmail, mascararEmail } from "./lib/derivar-nome-email";
export {
  badRequest,
  conflict,
  forbidden,
  internalServerError,
  notFound,
  preconditionFailed,
  rpcError,
  tooManyRequests,
  unauthorized,
} from "./lib/rpc-error";
export {
  getAsaasApiKey,
  isAsaasSandbox,
  type AsaasSecretsEnv,
  type SecretsStoreSecretBinding,
} from "./lib/asaas-env";
export {
  getEvolutionCredentials,
  type EvolutionCredentials,
  type EvolutionSecretsEnv,
} from "./lib/evolution-env";
export {
  buildAcaoEvolutionLogKey,
  derivarEvolutionAcaoLog,
  prepararEvolutionAcaoLogEntry,
  putEvolutionAcaoLog,
  redigirEvolutionLogPayload,
  type EvolutionAcaoLogDerivado,
  type EvolutionAcaoLogEntry,
} from "./lib/evolution-acao-r2-log";
export { criarClienteEvolutionGo, type EvolutionGoEnv } from "./lib/criar-cliente-evolution-go";
export { getClientIp } from "./lib/client-ip";
export {
  iniciarDemonstracaoSeNecessarioDb,
  marcarInstanciaConectadaEvolution,
  marcarInstanciaDesconectadaEvolution,
  resolverStatusAposConexaoEvolution,
  type StatusInstanciaAposConexao,
} from "./lib/instancia-evolution";
export {
  STATUS_SWEEP_EVOLUTION,
  descartarInstanciaEvolutionAbandonada,
  instanciaEvolutionEstaAbandonada,
  listarInstanciasEvolutionParaSweep,
  resolverReferenciaAbandonoEvolution,
  varrerInstanciasEvolutionAbandonadas,
  type EnvDescarteEvolution,
  type InstanciaEvolutionAbandonadaRow,
  type InstanciaParaCriterioAbandono,
  type ResultadoDescarteEvolution,
  type ResultadoVarreduraEvolution,
  type StatusSweepEvolution,
} from "./lib/instancia-evolution-abandonada";
export { resolveSessionJwtSecret } from "./lib/session-jwt-secret";
export type { BaseEnv, DbContext } from "./types";
