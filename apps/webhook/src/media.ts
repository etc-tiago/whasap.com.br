import type { WorkerExecutionContext } from "@whasap/evlog/workers";
import { criarClienteEvolutionGo, getEvolutionCredentials } from "@whasap/api-core";
import { log } from "@whasap/evlog";
import { eq } from "drizzle-orm";
import { buildSecureInboundMediaR2Key, mimeToExtension } from "@whasap/config";
import { mensagem, type Db } from "@whasap/db";
import { createMetaClient } from "@whasap/meta";

import type { Env } from "./env";

export type InboundMediaJob =
  | {
      provider: "evo";
      instanceUuid: string;
      messageId: number;
      externalId: string;
      type: string;
      instanceToken: string;
      messageKey: { remoteJid: string; fromMe: boolean; id: string };
      waMessage?: Record<string, unknown>;
      mimeType?: string;
      base64?: string;
      fileName?: string;
    }
  | {
      provider: "meta_cloud";
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
  ctx: WorkerExecutionContext,
  env: Env,
  db: Db,
  job: InboundMediaJob | null,
): void {
  if (!job) return;
  ctx.waitUntil(
    storeInboundMedia(env, db, job).catch((err) => {
      log.error({
        contexto: "webhook.media",
        erro: err instanceof Error ? err.message : String(err),
        messageId: job.messageId,
        provider: job.provider,
      });
    }),
  );
}

export async function storeInboundMedia(env: Env, db: Db, job: InboundMediaJob): Promise<void> {
  let buffer: ArrayBuffer;
  let mimeType: string;

  if (job.provider === "evo") {
    if (job.base64) {
      mimeType = job.mimeType ?? "application/octet-stream";
      buffer = base64ToArrayBuffer(job.base64);
    } else {
      let creds: { baseUrl: string; apiKey: string };
      try {
        creds = await getEvolutionCredentials(env);
      } catch {
        log.error({ contexto: "webhook.media", erro: "Evolution API não configurada no worker" });
        return;
      }

      const client = criarClienteEvolutionGo(
        env,
        creds,
        { instanceToken: job.instanceToken },
        {
          instanciaUuid: job.instanceUuid,
          origem: "webhook",
          rpc: "webhook.media.download",
        },
      );
      const result = await client.downloadMedia(job.waMessage ?? { key: job.messageKey });
      const b64 = result.base64 ?? result.data;
      if (!b64) {
        log.error({
          contexto: "webhook.media",
          erro: "Evolution downloadmedia sem base64",
          externalId: job.externalId,
        });
        return;
      }
      mimeType = result.mimetype ?? job.mimeType ?? "application/octet-stream";
      buffer = base64ToArrayBuffer(b64);
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
  const hmacSecret = env.CDN_HMAC_SECRET ?? env.WHATSAPP_CLOUD_WEBHOOK_SECRET;
  const r2Key = await buildSecureInboundMediaR2Key(
    hmacSecret,
    job.instanceUuid,
    job.externalId,
    ext,
  );

  await env.CDN_R2.put(r2Key, buffer, {
    httpMetadata: { contentType: mimeType },
  });

  await db.update(mensagem).set({ midiaR2Chave: r2Key }).where(eq(mensagem.id, job.messageId));
}
