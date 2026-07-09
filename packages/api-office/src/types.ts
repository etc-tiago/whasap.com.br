import type { Db } from "@whasap/db";
import type {
  BaseEnv,
  EstadoSessaoRpc,
  EvolutionSecretsEnv,
  SecretsStoreSecretBinding,
} from "@whasap/api-core";

export type OfficeUsuario = {
  id: string;
  internalId: number;
  email: string;
  nome: string;
};

export type OfficeContext = {
  db: Db;
  env: OfficeEnv;
  request: Request;
  clientIp: string | undefined;
  officeUsuario: OfficeUsuario | null;
  sessionToken: string | null;
  sessionExpiraEm?: Date | null;
  estadoSessao?: EstadoSessaoRpc;
  fecharDb: () => Promise<void>;
};

export type OfficeEnv = BaseEnv &
  EvolutionSecretsEnv & {
    OFFICE_URL: string;
    WEB_URL: string;
    R2: R2Bucket;
    WORKER_NAME?: string;
    OFFICE_SESSION_JWT_SECRET: SecretsStoreSecretBinding | string;
  };
