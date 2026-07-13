/**
 * Persistência de mídia inbound (Evolution / Meta) no bucket CDN + `mensagem.midiaR2Chave`.
 */
import { buildSecureInboundMediaR2Key, mimeToExtension } from "@whasap/config";
import { mensagem, type Db } from "@whasap/db";
import { EvolutionGoDownloadMediaError } from "@whasap/evolution";
import { eq } from "drizzle-orm";

import { criarClienteEvolutionGo } from "./criar-cliente-evolution-go";
import { getEvolutionCredentials, type EvolutionSecretsEnv } from "./evolution-env";
import { criarClienteMeta } from "./criar-cliente-meta";

export type MidiaInboundEnv = EvolutionSecretsEnv & {
  CDN_R2: R2Bucket;
  R2?: R2Bucket;
  CDN_HMAC_SECRET?: string;
  WHATSAPP_CLOUD_WEBHOOK_SECRET?: string;
};

export type JobMidiaInbound =
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

/** Converte base64 (com ou sem data-URL) em ArrayBuffer. */
export function base64ParaArrayBuffer(base64: string): ArrayBuffer {
  const normalized = base64.replace(/^data:[^;]+;base64,/, "");
  const fromBase64 = (Uint8Array as unknown as { fromBase64?: (s: string) => Uint8Array })
    .fromBase64;
  if (typeof fromBase64 === "function") {
    return fromBase64(normalized).buffer as ArrayBuffer;
  }
  const binary = atob(normalized);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}

/**
 * Baixa (se preciso), grava no CDN R2 e atualiza `midiaR2Chave`.
 * Com `base64` inline no job Evolution, não chama a API de download.
 */
export async function persistirMidiaInbound(
  env: MidiaInboundEnv,
  db: Db,
  job: JobMidiaInbound,
): Promise<void> {
  let buffer: ArrayBuffer;
  let mimeType: string;

  if (job.provider === "evo") {
    const inlineBase64 =
      job.base64 ?? (typeof job.waMessage?.base64 === "string" ? job.waMessage.base64 : undefined);

    if (inlineBase64) {
      mimeType = job.mimeType ?? "application/octet-stream";
      buffer = base64ParaArrayBuffer(inlineBase64);
    } else if (!job.waMessage) {
      throw new Error(`Evolution mídia sem waMessage/base64 (${job.externalId})`);
    } else {
      const creds = await getEvolutionCredentials(env);
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
      try {
        const result = await client.downloadMedia(job.waMessage);
        const b64 = result.base64;
        if (!b64) {
          throw new Error(`Evolution downloadmedia sem base64 (${job.externalId})`);
        }
        mimeType = result.mimetype ?? job.mimeType ?? "application/octet-stream";
        buffer = base64ParaArrayBuffer(b64);
      } catch (err) {
        if (err instanceof EvolutionGoDownloadMediaError) {
          if (err.codigo === "unauthorized" || err.codigo === "forbidden") {
            throw new Error(
              `Evolution downloadmedia ${err.codigo} (${err.status}) (${job.externalId})`,
              { cause: err },
            );
          }
        }
        throw err;
      }
    }
  } else {
    const meta = criarClienteMeta(
      env,
      {
        accessToken: job.accessToken,
        phoneNumberId: job.phoneNumberId,
        wabaId: job.wabaId,
      },
      {
        instanciaUuid: job.instanceUuid,
        origem: "webhook",
        rpc: "webhook.media.download",
      },
    );
    const downloaded = await meta.downloadMedia(job.mediaId);
    buffer = downloaded.buffer;
    mimeType = downloaded.mimeType ?? job.mimeType ?? "application/octet-stream";
  }

  const ext = mimeToExtension(mimeType, job.fileName);
  const hmacSecret = env.CDN_HMAC_SECRET ?? env.WHATSAPP_CLOUD_WEBHOOK_SECRET;
  if (!hmacSecret) {
    throw new Error("CDN_HMAC_SECRET ou WHATSAPP_CLOUD_WEBHOOK_SECRET ausente");
  }

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
