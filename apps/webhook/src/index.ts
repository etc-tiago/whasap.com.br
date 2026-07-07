import { createDb, appCreateData } from "@whasap/db";

import { handleAsaasWebhook } from "./asaas";
import type { Env } from "./env";
import { processEvolutionWebhook, processMetaWebhook } from "./processors";
import { cloudLogKeyFromBody, evolutionLogKeyFromBody, putWebhookLog } from "./r2-log";

export type { Env } from "./env";

async function timingSafeEqual(a: string, b: string): Promise<boolean> {
  const encoder = new TextEncoder();
  const aBytes = encoder.encode(a);
  const bBytes = encoder.encode(b);
  if (aBytes.byteLength !== bBytes.byteLength) return false;
  return crypto.subtle.timingSafeEqual(aBytes, bBytes);
}

async function handleProviderWebhook(
  ctx: ExecutionContext,
  env: Env,
  source: "evo" | "cloud",
  body: string,
): Promise<Response> {
  const { client } = createDb(env.HYPERDRIVE.connectionString);
  const r2Key = source === "evo" ? evolutionLogKeyFromBody(body) : cloudLogKeyFromBody(body);

  ctx.waitUntil(
    putWebhookLog(env, r2Key, body, { source, path: r2Key }).catch((err) => {
      console.error(`[webhook] R2 log failed (${source}):`, err);
    }),
  );

  const event = await client.webhookEvento.create({
    data: appCreateData({
      origem: source,
      idEvento: r2Key,
      payload: body,
    }),
  });

  try {
    if (source === "cloud") {
      await processMetaWebhook(client, env, ctx, body);
    } else {
      await processEvolutionWebhook(client, env, ctx, body);
    }
    await client.webhookEvento.update({
      where: { id: event.id },
      data: { processadoEm: new Date() },
    });
  } catch (err) {
    console.error(`[webhook] processor error (${source}):`, err);
  }

  return new Response(JSON.stringify({ received: true }), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    if (request.method === "GET" && url.pathname === "/cloud") {
      const mode = url.searchParams.get("hub.mode");
      const token = url.searchParams.get("hub.verify_token");
      const challenge = url.searchParams.get("hub.challenge");
      if (mode === "subscribe" && token === env.WEBHOOK_SECRET && challenge) {
        return new Response(challenge, { status: 200 });
      }
      return new Response("Forbidden", { status: 403 });
    }

    if (request.method !== "POST") {
      return new Response("Method not allowed", { status: 405 });
    }

    const body = await request.text();

    if (url.pathname === "/asaas") {
      const { client } = createDb(env.HYPERDRIVE.connectionString);
      const token = request.headers.get("asaas-access-token") ?? "";
      const valid = await timingSafeEqual(token, env.ASAAS_WEBHOOK_TOKEN);
      if (!valid) {
        return new Response("Invalid signature", { status: 401 });
      }
      const event = JSON.parse(body) as { id: string; event: string };
      try {
        await client.asaasWebhookRegistro.create({
          data: appCreateData({
            asaasIdEvento: event.id,
            tipo: event.event,
            payload: body,
          }),
        });
      } catch {
        return new Response(JSON.stringify({ received: true }), {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      }
      await handleAsaasWebhook(client, body, env);
      return new Response(JSON.stringify({ received: true }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    }

    if (url.pathname === "/evo") {
      return handleProviderWebhook(ctx, env, "evo", body);
    }

    if (url.pathname === "/cloud") {
      return handleProviderWebhook(ctx, env, "cloud", body);
    }

    return new Response("Not found", { status: 404 });
  },
};
