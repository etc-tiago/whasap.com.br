export type EvolutionConnectionState = "open" | "close" | "connecting";

export type EvolutionQrData = {
  qrcode?: string;
  code?: string;
  /** Legado */
  base64?: string;
  pairingCode?: string;
  qr?: string;
};

export type EvolutionQrResponse = {
  pairingCode?: string;
  code?: string;
  base64?: string;
  qr?: string;
  count?: number;
  data?: EvolutionQrData;
  message?: string;
  error?: string;
};

export type EvolutionSendResponse = {
  key?: { id: string };
  id?: string;
  messageId?: string;
};
