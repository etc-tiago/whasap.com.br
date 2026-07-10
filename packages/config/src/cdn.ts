import { mvpDefaults } from "./mvp-defaults";

const MIME_EXT: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
  "audio/ogg": "ogg",
  "audio/ogg; codecs=opus": "ogg",
  "audio/mpeg": "mp3",
  "audio/mp4": "m4a",
  "video/mp4": "mp4",
  "application/pdf": "pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
  "application/msword": "doc",
};

export function cdnMediaUrl(baseUrl: string, r2Key: string): string {
  return `${baseUrl.replace(/\/$/, "")}/${r2Key.replace(/^\//, "")}`;
}

export function cdnMediaUrlFromDefaults(r2Key: string): string {
  return cdnMediaUrl(mvpDefaults.cdn.baseUrl, r2Key);
}

export function mimeToExtension(mimeType: string, fileName?: string): string {
  if (fileName) {
    const dot = fileName.lastIndexOf(".");
    if (dot > 0) return fileName.slice(dot + 1).toLowerCase();
  }
  const base = mimeType.split(";")[0]?.trim().toLowerCase() ?? "";
  return MIME_EXT[base] ?? base.split("/")[1] ?? "bin";
}

export function buildMediaR2Key(instanceUuid: string, externalId: string, ext: string): string {
  const safeId = externalId.replace(/[^a-zA-Z0-9_-]/g, "_");
  return `${mvpDefaults.cdn.mediaPrefix}/${instanceUuid}/${safeId}.${ext}`;
}

/** Chave R2 para mídia enviada pelo painel antes de existir id externo da mensagem. */
export function buildOutboundMediaR2Key(instanceUuid: string, ext: string): string {
  return `${mvpDefaults.cdn.mediaPrefix}/${instanceUuid}/outbound/${crypto.randomUUID()}.${ext}`;
}
