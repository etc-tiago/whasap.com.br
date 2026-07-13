/**
 * Extrai metadados de mídia de um MessageObj Evolution GO.
 * SendMessage real traz `base64` no topo do Message (não só dentro de *Message).
 */

export type MidiaGoExtraida = {
  type: "image" | "audio" | "document" | "video" | "sticker";
  body: string;
  mimeType?: string;
  base64?: string;
  fileName?: string;
};

type EvolutionMediaPart = {
  caption?: string;
  mimetype?: string;
  fileName?: string;
  base64?: string;
};

/**
 * Resolve tipo/body/mimetype e base64 inline (parte ou topo do Message).
 * @returns null se o objeto não for de mídia conhecida.
 */
export function extrairMidiaGoDeMessageObj(
  messageObj: Record<string, unknown> | null | undefined,
): MidiaGoExtraida | null {
  if (!messageObj) return null;

  const msgBase64 = typeof messageObj.base64 === "string" ? messageObj.base64 : undefined;

  if (messageObj.imageMessage) {
    const part = messageObj.imageMessage as EvolutionMediaPart;
    return {
      type: "image",
      body: part.caption ?? "[imagem]",
      mimeType: part.mimetype,
      base64: part.base64 ?? msgBase64,
      fileName: part.fileName,
    };
  }
  if (messageObj.audioMessage) {
    const part = messageObj.audioMessage as EvolutionMediaPart;
    return {
      type: "audio",
      body: "[áudio]",
      mimeType: part.mimetype,
      base64: part.base64 ?? msgBase64,
      fileName: part.fileName,
    };
  }
  if (messageObj.documentMessage) {
    const part = messageObj.documentMessage as EvolutionMediaPart;
    return {
      type: "document",
      body: part.fileName ?? part.caption ?? "[documento]",
      mimeType: part.mimetype,
      base64: part.base64 ?? msgBase64,
      fileName: part.fileName,
    };
  }
  if (messageObj.videoMessage) {
    const part = messageObj.videoMessage as EvolutionMediaPart;
    return {
      type: "video",
      body: part.caption ?? "[vídeo]",
      mimeType: part.mimetype,
      base64: part.base64 ?? msgBase64,
      fileName: part.fileName,
    };
  }
  if (messageObj.stickerMessage) {
    const part = messageObj.stickerMessage as EvolutionMediaPart;
    return {
      type: "sticker",
      body: "[sticker]",
      mimeType: part.mimetype,
      base64: part.base64 ?? msgBase64,
      fileName: part.fileName,
    };
  }
  return null;
}
