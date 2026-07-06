import type { Client, Db } from "@whasap/db";
import type { BaseEnv } from "@whasap/api-core";

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
  client: Client;
  env: WebEnv;
  request: Request;
  clientIp: string | undefined;
  usuario: WebUsuario | null;
  organizationId: number | null;
  role: MemberRole | null;
  sessionToken: string | null;
};

export type WebEnv = BaseEnv & {
  WEB_URL: string;
  OFFICE_URL: string;
  WEBHOOK_URL: string;
  AUTH_SECRET: string;
  ASAAS_API_KEY: string;
  ASAAS_SANDBOX?: string;
  EVOLUTION_BASE_URL?: string;
  EVOLUTION_API_KEY?: string;
  EVOLUTION_SECRETS_STORE?: SecretsStoreBinding;
  META_SECRETS_STORE?: SecretsStoreBinding;
};

export type SecretsStoreBinding = {
  get: (name: string) => Promise<string>;
  put: (name: string, value: string) => Promise<void>;
};