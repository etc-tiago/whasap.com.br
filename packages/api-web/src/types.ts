import type { Db } from "@whasap/db";
import type { BaseEnv, EstadoSessaoRpc, SecretsStoreSecretBinding } from "@whasap/api-core";

export type MemberRole = "admin" | "usuario" | "analista";

export type WebUsuario = {
  id: string;
  internalId: number;
  email: string;
  nome: string;
  emailVerificadoEm: Date | null;
};

export type WebContext = {
  db: Db;
  env: WebEnv;
  request: Request;
  clientIp: string | undefined;
  usuario: WebUsuario | null;
  organizationId: number | null;
  role: MemberRole | null;
  sessionToken: string | null;
  sessionExpiraEm?: Date | null;
  estadoSessao?: EstadoSessaoRpc;
  fecharDb: () => Promise<void>;
};

export type WebEnv = BaseEnv & {
  WEB_URL: string;
  OFFICE_URL: string;
  WEBHOOK_URL: string;
  CDN_URL: string;
  R2?: R2Bucket;
  /** Bucket de mídia servida pelo CDN (`whasap-cdn`). */
  CDN_R2?: R2Bucket;
  CDN_HMAC_SECRET?: string;
  WHATSAPP_CLOUD_WEBHOOK_SECRET?: string;
  WORKER_NAME?: string;
  ASSAS_API_KEY?: SecretsStoreSecretBinding | string;
  ASAAS_SANDBOX?: string;
  /** Secrets Store (produção) ou string JSON em `.dev.vars`: `{ "baseUrl", "apiKey" }` */
  EVOLUTION_SECRETS_STORE?: SecretsStoreSecretBinding | string;
  /** Quando `EVOLUTION_DEBUG=true`: respostas brutas da Evolution (tokens redigidos). */
  EVOLUTION_DEBUG?: string;
  WEB_SESSION_JWT_SECRET: SecretsStoreSecretBinding | string;
};
