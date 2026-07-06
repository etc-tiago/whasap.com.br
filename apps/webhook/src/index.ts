import { createDb, appCreateData } from "@whasap/db";

import { handleAsaasWebhook } from "./asaas";
import type { Env } from "./env";
import { processEvolutionWebhook, processMetaWebhook } from "./processors";

export type { Env } from "./env";

async function timingSafeEqual(a: string, b: string): Promise<boolean> {
  const encoder = new TextEncoder();
  const aBytes = encoder.encode(a);
  const bBytes = encoder.encode(b);
  if (aBytes.byteLength !== bBytes.byteLength) return false;
  return crypto.subtle.timingSafeEqual(aBytes, bBytes);
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (request.method === "GET" && url.pathname === "/meta") {
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
    const { client } = createDb(env.HYPERDRIVE.connectionString);

    if (url.pathname === "/asaas") {
      const token = request.headers.get("asaas-access-token") ?? "";
      const valid = await timingSafeEqual(token, env.ASAAS_WEBHOOK_TOKEN);
      if (!valid) {
        return new Response("Invalid signature", { status: 401 });
      }
      const event = JSON.parse(body) as { id: string; event: string };
      try {
        await client.asaasWebhookLog.create({
          data: appCreateData({
            asaasEventId: event.id,
            type: event.event,
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

    const source =
      url.pathname === "/meta"
        ? "meta"
        : url.pathname === "/evolution"
          ? "evolution"
          : (request.headers.get("x-webhook-source") ?? "unknown");

    if (url.pathname !== "/meta" && url.pathname !== "/evolution") {
      const signature = request.headers.get("x-webhook-signature") ?? "";
      const valid = await timingSafeEqual(signature, env.WEBHOOK_SECRET);
      if (!valid) {
        return new Response("Unauthorized", { status: 401 });
      }
    }

    const event = await client.webhookEvents.create({
      data: appCreateData({
        source,
        payload: body,
      }),
    });

    try {
      if (source === "meta") {
        await processMetaWebhook(client, body);
      } else if (source === "evolution") {
        await processEvolutionWebhook(client, body);
      }
      await client.webhookEvents.update({
        where: { id: event.id },
        data: { processedAt: new Date() },
      });
    } catch (err) {
      console.error("[webhook] processor error:", err);
    }

    return new Response(JSON.stringify({ received: true }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  },
};
