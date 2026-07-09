import { log } from "@whasap/evlog";

const MAX_BASE64_PREVIEW = 80;
const SENSITIVE_KEYS = new Set([
  "token",
  "accessToken",
  "accesstoken",
  "evolucaoToken",
  "apikey",
  "apiKey",
]);

export type EvolutionAcaoLogEntry = {
  at: string;
  tipo: string;
  method: string;
  path: string;
  status: number | null;
  durationMs: number;
  requestBody?: unknown;
  responseBody?: unknown;
  error?: string;
  meta?: Record<string, string>;
};

function sanitizeSegment(value: string): string {
  return value.replace(/[^a-zA-Z0-9._-]+/g, "_").slice(0, 120) || "unknown";
}

/** `acao/{tipo}/{YYYY-MM-DD}/{HH-mm-ss}/{uuid}.json` */
export function buildAcaoEvolutionLogKey(tipo: string, at = new Date()): string {
  const date = at.toISOString().slice(0, 10);
  const time = at.toISOString().slice(11, 19).replace(/:/g, "-");
  const id = crypto.randomUUID();
  return `acao/${sanitizeSegment(tipo)}/${date}/${time}/${id}.json`;
}

function truncateBase64(value: string): { length: number; preview: string } {
  return {
    length: value.length,
    preview: value.slice(0, MAX_BASE64_PREVIEW),
  };
}

/** Redige tokens e trunca base64/QR antes de persistir no R2. */
export function redigirEvolutionLogPayload(value: unknown): unknown {
  if (value === null || value === undefined) return value;
  if (typeof value === "string") {
    if (value.length > 200 && /^[A-Za-z0-9+/=]+$/.test(value.slice(0, 100))) {
      return truncateBase64(value);
    }
    return value;
  }
  if (Array.isArray(value)) {
    return value.map((item) => redigirEvolutionLogPayload(item));
  }
  if (typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
      if (SENSITIVE_KEYS.has(key)) {
        out[key] = "[redacted]";
        continue;
      }
      if (key === "base64" && typeof val === "string") {
        out[key] = truncateBase64(val);
        continue;
      }
      if (key === "qr" && typeof val === "string" && val.length > 200) {
        out[key] = truncateBase64(val);
        continue;
      }
      out[key] = redigirEvolutionLogPayload(val);
    }
    return out;
  }
  return value;
}

export function prepararEvolutionAcaoLogEntry(
  entry: Omit<EvolutionAcaoLogEntry, "at"> & { at?: string },
): EvolutionAcaoLogEntry {
  return {
    at: entry.at ?? new Date().toISOString(),
    tipo: entry.tipo,
    method: entry.method,
    path: entry.path,
    status: entry.status,
    durationMs: entry.durationMs,
    requestBody:
      entry.requestBody !== undefined ? redigirEvolutionLogPayload(entry.requestBody) : undefined,
    responseBody:
      entry.responseBody !== undefined ? redigirEvolutionLogPayload(entry.responseBody) : undefined,
    error: entry.error,
    meta: entry.meta,
  };
}

/** Grava log de ação Evolution no R2 (fire-and-forget; nunca propaga erro). */
export function putEvolutionAcaoLog(r2: R2Bucket, entry: EvolutionAcaoLogEntry): void {
  const key = buildAcaoEvolutionLogKey(entry.tipo, new Date(entry.at));
  const body = JSON.stringify(prepararEvolutionAcaoLogEntry(entry));

  void r2
    .put(key, body, { httpMetadata: { contentType: "application/json" } })
    .catch((err: unknown) => {
      log.warn({
        evolution: {
          acaoR2Falhou: true,
          tipo: entry.tipo,
          key,
          erro: err instanceof Error ? err.message : String(err),
        },
      });
    });
}
