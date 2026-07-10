/** Envelope padrão GO em respostas de sucesso. */
export type EvolutionGoApiSuccess<T> = {
  data: T;
  message: string;
};

/** Envelope de erro (HTTP 400). */
export type EvolutionGoApiError = {
  error: string;
};

/** Verifica envelope de erro `{ error: string }`. */
export function isEvolutionGoApiError(body: unknown): body is EvolutionGoApiError {
  return (
    typeof body === "object" &&
    body !== null &&
    "error" in body &&
    typeof (body as EvolutionGoApiError).error === "string"
  );
}

/** Verifica envelope de sucesso `{ data, message }`. */
export function isEvolutionGoApiSuccess<T = unknown>(
  body: unknown,
): body is EvolutionGoApiSuccess<T> {
  return (
    typeof body === "object" &&
    body !== null &&
    "data" in body &&
    "message" in body &&
    typeof (body as EvolutionGoApiSuccess<T>).message === "string"
  );
}

/** Configurações avançadas de instância (`CreateStruct.advancedSettings`). */
export type EvolutionGoAdvancedSettings = {
  alwaysOnline?: boolean;
  ignoreGroups?: boolean;
  ignoreStatus?: boolean;
  msgRejectCall?: string;
  readMessages?: boolean;
  rejectCall?: boolean;
};

/** Configuração de proxy (`CreateStruct.proxy`). */
export type EvolutionGoProxyConfig = {
  host?: string;
  password?: string;
  port?: string;
  protocol?: string;
  username?: string;
};

/** Body de `POST /instance/create`. */
export type EvolutionGoCreateParams = {
  name: string;
  instanceId: string;
  token: string;
  advancedSettings?: EvolutionGoAdvancedSettings;
  proxy?: EvolutionGoProxyConfig;
};

/** Campo `data` de `POST /instance/create` (sucesso). */
export type EvolutionGoCreateInstanceData = {
  id: string;
  name: string;
  token: string;
  connected: boolean;
  webhook?: string;
  rabbitmqEnable?: string;
  websocketEnable?: string;
  natsEnable?: string;
  jid?: string;
  qrcode?: string;
  expiration?: number;
  disconnect_reason?: string;
  events?: string;
  os_name?: string;
  proxy?: string;
  client_name?: string;
  createdAt?: string;
  alwaysOnline?: boolean;
  rejectCall?: boolean;
  msgRejectCall?: string;
  readMessages?: boolean;
  ignoreGroups?: boolean;
  ignoreStatus?: boolean;
};

/** Resposta de `POST /instance/create` (sucesso ou campos legados no root). */
export type EvolutionGoCreateResponse = {
  data?: EvolutionGoCreateInstanceData & {
    /** Legado — servidor real usa `id`. */
    instanceId?: string;
  };
  message?: string;
  instanceId?: string;
  token?: string;
  name?: string;
};

/** Body de `POST /instance/connect`. */
export type EvolutionConnectParams = {
  webhookUrl: string;
  phone?: string;
  subscribe?: readonly string[];
  /** Instância já conectada: aplica webhook/eventos sem reiniciar o QR. */
  immediate?: boolean;
  rabbitmqEnable?: string;
  websocketEnable?: string;
  natsEnable?: string;
};

/** Campo `data` de `POST /instance/connect` (sucesso). */
export type EvolutionGoConnectData = {
  eventString: string;
  jid: string;
  webhookUrl: string;
};

/** Resposta de `POST /instance/connect`. */
export type EvolutionGoConnectResponse = EvolutionGoApiSuccess<EvolutionGoConnectData>;
