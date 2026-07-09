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
  type EvolutionConnectParams,
  type EvolutionGoCreateResponse,
} from "./client-go";
export { EVOLUTION_WEBHOOK_SUBSCRIBE_ALL } from "./webhook-events";
export {
  type EvolutionConnectionState,
  type EvolutionQrResponse,
  type EvolutionSendResponse,
} from "./types";

import { createEvolutionGoClient } from "./client-go";

/** Client Evolution GO — alias principal. */
export const createEvolutionClient = createEvolutionGoClient;
