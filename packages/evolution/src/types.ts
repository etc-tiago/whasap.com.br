export type EvolutionConnectionState = "open" | "close" | "connecting";

export type EvolutionQrResponse = {
  pairingCode?: string;
  code?: string;
  base64?: string;
  qr?: string;
  count?: number;
  data?: {
    qrcode?: string;
    base64?: string;
    pairingCode?: string;
    code?: string;
    qr?: string;
  };
  message?: string;
};

export type EvolutionSendResponse = {
  key?: { id: string };
  id?: string;
  messageId?: string;
};
