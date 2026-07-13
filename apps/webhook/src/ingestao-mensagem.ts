/**
 * Re-exporta ingestão compartilhada (`@whasap/api-core`) para o worker webhook.
 */
export {
  atualizarStatusMensagemPorIdExterno,
  buscarContatoPorIdExterno,
  decrementarNaoLidas,
  ingerirMensagem,
  marcarConversaLidaLocal,
  type IngerirMensagemParams,
} from "@whasap/api-core";
