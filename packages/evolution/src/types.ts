export type EvolutionConnectionState = "open" | "close" | "connecting";

export type EvolutionQrResponse = {
  pairingCode?: string;
  code?: string;
  base64?: string;
  count?: number;
};

export type EvolutionSendResponse = {
  key?: { id: string };
  id?: string;
  messageId?: string;
};
