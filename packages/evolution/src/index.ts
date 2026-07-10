export {
  evolutionCredentialsSchema,
  parseEvolutionCredentials,
  type EvolutionCredentials,
  type EvolutionGoInstanceContext,
} from "./credentials";
export {
  parseConnectionUpdateWebhook,
  parseGoConnectionState,
  parseGoDisconnectedEvent,
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
  corPainelParaIndiceWhatsapp,
  extrairLabelIdResposta,
  indiceWhatsappParaCorPainel,
  jidDeContato,
} from "./labels";
export {
  deveIgnorarHistorySyncChunk,
  historySyncConcluido,
  jidParaIdExterno,
  jidParaTelefone,
  montarJidContato,
  parseGoButtonClick,
  parseGoHistorySyncChunk,
  parseGoLabelAssociation,
  parseGoMessageEvent,
  parseGoPairSuccess,
  parseGoPushName,
  parseGoReceipt,
  receiptIndicaLeitura,
  resolverIdExternoCanonicoGo,
  resolverInstanciaWebhookGo,
  telefoneExibicaoDeInfo,
  type EvolutionGoWebhookPayload,
  type GoButtonClick,
  type GoHistorySyncChunk,
  type GoLabelAssociation,
  type GoMensagemNormalizada,
  type GoPushName,
  type GoReceiptNormalizado,
} from "./webhook-go";
export {
  extrairFlowToken,
  formatInteractiveBody,
  formatInteractiveResponseBody,
  parseFlowResponseDeExtraData,
  parseInteractiveMessage,
  parseInteractiveResponseMessage,
  parseParamsJSON,
  type GoFlowButton,
  type GoFlowMessage,
  type GoFlowResponse,
} from "./flow-parser";
export {
  type EvolutionConnectionState,
  type EvolutionQrData,
  type EvolutionQrResponse,
  type EvolutionSendResponse,
} from "./types";

import { createEvolutionGoClient } from "./client-go";

/** Client Evolution GO — alias principal. */
export const createEvolutionClient = createEvolutionGoClient;
