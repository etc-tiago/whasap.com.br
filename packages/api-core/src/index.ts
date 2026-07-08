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
export { contarOtpsRecentes, assertOtpSendAllowed, criarOtp, normalizarOtp, slugify, verificarOtp } from "./lib/otp";
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
export { getClientIp } from "./lib/client-ip";
export { resolveSessionJwtSecret } from "./lib/session-jwt-secret";
export type { BaseEnv, DbContext } from "./types";
