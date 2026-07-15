export {
  evolutionCredentialsSchema,
  parseEvolutionCredentials,
  type EvolutionCredentials,
  type EvolutionGoInstanceContext,
} from "./credentials";
export {
  parseConnectionUpdateWebhook,
  parseGoConnectedEvent,
  parseGoConnectionLifecycleEvent,
  parseGoConnectionState,
  parseGoDisconnectedEvent,
  parseGoLoggedOutEvent,
  parseGoQrResponse,
  type EvolutionConnectionUpdatePayload,
  type EvolutionGoStatusResponse,
} from "./connection-state";
export {
  createEvolutionGoClient,
  extractGoMessageId,
  parseGoCreateResponse,
  classificarErroDownloadMedia,
  normalizarDownloadMediaBody,
  EvolutionGoDownloadMediaError,
  type EvolutionGoClientOptions,
  type EvolutionGoDownloadMediaCodigo,
  type EvolutionGoDownloadMediaResult,
  type EvolutionGoLogSink,
  type EvolutionGoRequestLogEntry,
} from "./client-go";
export {
  cdnMidiaPresumivelmenteExpirada,
  coletarCaminhosMidiaWa,
  extrairTimestampsOe,
} from "./download-media-cdn";
export { extrairMidiaGoDeMessageObj, type MidiaGoExtraida } from "./midia-go";
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
  CORES_WHATSAPP,
  corPainelParaIndiceWhatsapp,
  extrairLabelIdResposta,
  indiceWhatsappParaCorPainel,
  jidDeContato,
} from "./labels";
export {
  deveIgnorarHistorySyncChunk,
  HISTORY_SYNC_CHUNK_MSG_CAP,
  HISTORY_SYNC_TYPE,
  historySyncConcluido,
  jidParaIdExterno,
  jidParaTelefone,
  mapaLidParaPn,
  montarJidContato,
  normalizarStatusWmi,
  parseGoButtonClick,
  parseGoContact,
  parseGoGroupInfo,
  parseGoHistorySyncChunk,
  parseGoJoinedGroup,
  parseGoLabelAssociation,
  parseGoLabelEdit,
  parseGoMessageEvent,
  parseGoPairSuccess,
  parseGoPicture,
  parseGoPushName,
  parseGoQrTimeout,
  parseGoReceipt,
  receiptIndicaLeitura,
  resolverIdExternoCanonicoGo,
  resolverInstanciaWebhookGo,
  resolverJidHistoricoSync,
  rotuloHistorySyncType,
  telefoneExibicaoDeInfo,
  WMI_STATUS,
  type EvolutionGoWebhookPayload,
  type GoButtonClick,
  type GoContactUpdate,
  type GoGroupInfo,
  type GoHistorySyncChunk,
  type GoJoinedGroup,
  type GoLabelAssociation,
  type GoLabelEdit,
  type GoMensagemNormalizada,
  type GoPhoneLidMapping,
  type GoPictureUpdate,
  type GoPollPayload,
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
