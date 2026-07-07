import { buildMediaR2Key, mimeToExtension } from "@whasap/config";
import type { Client } from "@whasap/db";
import { createEvolutionClient } from "@whasap/evolution";
import { createMetaClient } from "@whasap/meta";

import type { Env } from "./env";

export type InboundMediaJob =
  | {
      provider: "evolution";
      instanceUuid: string;
      messageId: number;
      externalId: string;
      type: string;
      instanceName: string;
      messageKey: { remoteJid: string; fromMe: boolean; id: string };
      mimeType?: string;
      base64?: string;
      fileName?: string;
    }
  | {
      provider: "meta";
      instanceUuid: string;
      messageId: number;
      externalId: string;
      type: string;
      accessToken: string;
      phoneNumberId: string;
      wabaId: string;
      mediaId: string;
      mimeType?: string;
      fileName?: string;
    };

function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const normalized = base64.replace(/^data:[^;]+;base64,/, "");
  const binary = atob(normalized);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}

export function scheduleInboundMedia(
  ctx: ExecutionContext,
  env: Env,
  client: Client,
  job: InboundMediaJob | null,
): void {
  if (!job) return;
  ctx.waitUntil(
    storeInboundMedia(env, client, job).catch((err) => {
      console.error("[webhook] media store failed:", err);
    }),
  );
}

export async function storeInboundMedia(
  env: Env,
  client: Client,
  job: InboundMediaJob,
): Promise<void> {
  let buffer: ArrayBuffer;
  let mimeType: string;

  if (job.provider === "evolution") {
    if (job.base64) {
      mimeType = job.mimeType ?? "application/octet-stream";
      buffer = base64ToArrayBuffer(job.base64);
    } else {
      const baseUrl = env.EVOLUTION_BASE_URL;
      const apiKey = env.EVOLUTION_API_KEY;
      if (!baseUrl || !apiKey) {
        console.error("[webhook] Evolution API não configurada no worker");
        return;
      }
      const evo = createEvolutionClient({ baseUrl, apiKey });
      const result = await evo.getBase64FromMediaMessage(
        job.instanceName,
        job.messageKey,
        job.type === "audio",
      );
      mimeType = result.mimetype ?? job.mimeType ?? "application/octet-stream";
      buffer = base64ToArrayBuffer(result.base64);
    }
  } else {
    const meta = createMetaClient({
      accessToken: job.accessToken,
      phoneNumberId: job.phoneNumberId,
      wabaId: job.wabaId,
    });
    const downloaded = await meta.downloadMedia(job.mediaId);
    buffer = downloaded.buffer;
    mimeType = downloaded.mimeType ?? job.mimeType ?? "application/octet-stream";
  }

  const ext = mimeToExtension(mimeType, job.fileName);
  const r2Key = buildMediaR2Key(job.instanceUuid, job.externalId, ext);

  await env.CDN_R2.put(r2Key, buffer, {
    httpMetadata: { contentType: mimeType },
  });

  await client.mensagem.update({
    where: { id: job.messageId },
    data: { midiaR2Chave: r2Key },
  });
}
