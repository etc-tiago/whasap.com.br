/**
 * Re-exporta ingestão compartilhada (`@whasap/api-core`) para o worker webhook.
 */
export {
  atualizarStatusMensagemPorIdExterno,
  aplicarEdicaoMensagem,
  buscarContatoPorIdExterno,
  buscarMensagemPorIdExterno,
  decrementarNaoLidas,
  ingerirMensagem,
  marcarConversaLidaLocal,
  type IngerirMensagemParams,
} from "@whasap/api-core";
