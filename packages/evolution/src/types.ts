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

/** Resposta de `/send/*` Evolution GO (whatsmeow) e shapes legados. */
export type EvolutionSendResponse = {
  message?: string;
  /** Shape GO: `{ Info: { ID }, Message }`. */
  data?: {
    Info?: { ID?: string; Id?: string; id?: string };
    Message?: Record<string, unknown>;
  };
  /** Shape GO flat (raro). */
  Info?: { ID?: string; Id?: string; id?: string };
  /** Shape Baileys / legado. */
  key?: { id: string };
  id?: string;
  messageId?: string;
};
