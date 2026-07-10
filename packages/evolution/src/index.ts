export {
  evolutionCredentialsSchema,
  parseEvolutionCredentials,
  type EvolutionCredentials,
  type EvolutionGoInstanceContext,
} from "./credentials";
export {
  parseConnectionUpdateWebhook,
  parseGoConnectionState,
  parseGoQrResponse,
  type EvolutionConnectionUpdatePayload,
  type EvolutionGoStatusResponse,
} from "./connection-state";
export {
  createEvolutionGoClient,
  extractGoMessageId,
  parseGoCreateResponse,
  type EvolutionGoClientOptions,
  type EvolutionGoLogSink,
  type EvolutionGoRequestLogEntry,
} from "./client-go";
export {
  type EvolutionConnectParams,
  type EvolutionGoApiError,
  type EvolutionGoApiSuccess,
  type EvolutionGoConnectData,
  type EvolutionGoConnectResponse,
  type EvolutionGoCreateInstanceData,
  type EvolutionGoCreateParams,
  type EvolutionGoCreateResponse,
  isEvolutionGoApiError,
  isEvolutionGoApiSuccess,
} from "./instance-types";
export { EVOLUTION_WEBHOOK_SUBSCRIBE_ALL } from "./webhook-events";
export {
  type EvolutionConnectionState,
  type EvolutionQrData,
  type EvolutionQrResponse,
  type EvolutionSendResponse,
} from "./types";

import { createEvolutionGoClient } from "./client-go";

/** Client Evolution GO — alias principal. */
export const createEvolutionClient = createEvolutionGoClient;
