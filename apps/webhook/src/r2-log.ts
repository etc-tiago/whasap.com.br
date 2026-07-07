import type { Env } from "./env";

function sanitizeSegment(value: string): string {
  return value.replace(/[^a-zA-Z0-9._-]+/g, "_").slice(0, 120) || "unknown";
}

function timestampParts(): { date: string; time: string; suffix: string } {
  const now = new Date();
  const date = now.toISOString().slice(0, 10);
  const time = now.toISOString().slice(11, 23).replace(/[:.]/g, "");
  const suffix = crypto.randomUUID().slice(0, 8);
  return { date, time, suffix };
}

/** webhook/evo/{instance}/{date}/{event}-{time}-{id}.json */
export function buildEvolutionLogKey(instanceName: string, event: string): string {
  const { date, time, suffix } = timestampParts();
  return `webhook/evo/${sanitizeSegment(instanceName)}/${date}/${sanitizeSegment(event)}-${time}-${suffix}.json`;
}

/** webhook/cloud/{phoneNumberId}/{date}/{field}-{time}-{id}.json */
export function buildCloudLogKey(
  phoneNumberId: string,
  field: string,
  objectId?: string | null,
): string {
  const { date, time, suffix } = timestampParts();
  const id = objectId ? sanitizeSegment(objectId).slice(0, 24) : suffix;
  return `webhook/cloud/${sanitizeSegment(phoneNumberId)}/${date}/${sanitizeSegment(field)}-${time}-${id}.json`;
}

export async function putWebhookLog(
  env: Env,
  key: string,
  body: string,
  meta: Record<string, string>,
): Promise<void> {
  await env.R2.put(
    key,
    JSON.stringify({
      receivedAt: new Date().toISOString(),
      meta,
      raw: body,
    }),
    { httpMetadata: { contentType: "application/json" } },
  );
}

type EvolutionPayload = {
  event?: string;
  instance?: string;
};

type CloudPayload = {
  entry?: Array<{
    id?: string;
    changes?: Array<{
      field?: string;
      value?: {
        metadata?: { phone_number_id?: string };
        messages?: Array<{ id: string }>;
        statuses?: Array<{ id: string }>;
      };
    }>;
  }>;
};

export function evolutionLogKeyFromBody(body: string): string {
  try {
    const payload = JSON.parse(body) as EvolutionPayload;
    return buildEvolutionLogKey(payload.instance ?? "unknown", payload.event ?? "unknown");
  } catch {
    return buildEvolutionLogKey("unknown", "parse_error");
  }
}

export function cloudLogKeyFromBody(body: string): string {
  try {
    const payload = JSON.parse(body) as CloudPayload;
    const change = payload.entry?.[0]?.changes?.[0];
    const field = change?.field ?? "unknown";
    const phoneNumberId = change?.value?.metadata?.phone_number_id ?? "unknown";
    const objectId =
      change?.value?.messages?.[0]?.id ?? change?.value?.statuses?.[0]?.id ?? payload.entry?.[0]?.id;
    return buildCloudLogKey(phoneNumberId, field, objectId);
  } catch {
    return buildCloudLogKey("unknown", "parse_error");
  }
}
