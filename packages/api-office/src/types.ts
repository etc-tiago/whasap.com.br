import type { Client, Db } from "@whasap/db";
import type { BaseEnv } from "@whasap/api-core";

export type OfficeUsuario = {
  id: string;
  internalId: number;
  email: string;
  nome: string;
};

export type OfficeContext = {
  db: Db;
  client: Client;
  env: OfficeEnv;
  request: Request;
  clientIp: string | undefined;
  officeUsuario: OfficeUsuario | null;
  sessionToken: string | null;
};

export type OfficeEnv = BaseEnv & {
  OFFICE_URL: string;
};
