export {
  evolutionCredentialsSchema,
  parseEvolutionCredentials,
  type EvolutionCredentials,
  type EvolutionGoInstanceContext,
} from "./credentials";
export {
  createEvolutionGoClient,
  extractGoMessageId,
  parseGoConnectionState,
  parseGoCreateResponse,
  type EvolutionGoCreateResponse,
  type EvolutionGoStatusResponse,
} from "./client-go";
export {
  type EvolutionConnectionState,
  type EvolutionQrResponse,
  type EvolutionSendResponse,
} from "./types";

import { createEvolutionGoClient } from "./client-go";

/** Client Evolution GO — alias principal. */
export const createEvolutionClient = createEvolutionGoClient;
