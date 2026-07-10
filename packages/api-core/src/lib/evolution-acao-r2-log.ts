import { log } from "@whasap/evlog";
import {
  parseGoConnectionState,
  parseGoQrResponse,
  type EvolutionGoStatusResponse,
  type EvolutionQrResponse,
} from "@whasap/evolution";

const MAX_BASE64_PREVIEW = 80;
const SENSITIVE_KEYS = new Set([
  "token",
  "accessToken",
  "accesstoken",
  "evolucaoToken",
  "apikey",
  "apiKey",
]);

export type EvolutionAcaoLogDerivado = {
  estado?: string;
  conectado?: boolean;
  temQr?: boolean;
};

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
  derivado?: EvolutionAcaoLogDerivado;
  meta?: Record<string, string>;
};

function sanitizeSegment(value: string): string {
  return value.replace(/[^a-zA-Z0-9._-]+/g, "_").slice(0, 120) || "unknown";
}

/**
 * Chave R2 de ação Evolution.
 * Com `instanciaUuid`: `acao/{instanciaUuid}/{tipo}/{YYYY-MM-DD}/{HH-mm-ss}.{uuid}.json`
 * Sem: `acao/{tipo}/{YYYY-MM-DD}/{HH-mm-ss}.{uuid}.json`
 */
export function buildAcaoEvolutionLogKey(
  tipo: string,
  at = new Date(),
  instanciaUuid?: string,
): string {
  const date = at.toISOString().slice(0, 10);
  const time = at.toISOString().slice(11, 19).replace(/:/g, "-");
  const id = crypto.randomUUID();
  const tipoSeg = sanitizeSegment(tipo);
  const arquivo = `${time}.${id}.json`;
  if (instanciaUuid) {
    return `acao/${sanitizeSegment(instanciaUuid)}/${tipoSeg}/${date}/${arquivo}`;
  }
  return `acao/${tipoSeg}/${date}/${arquivo}`;
}

/** Deriva estado/conectado/temQr a partir da resposta Evolution para o log R2. */
export function derivarEvolutionAcaoLog(
  tipo: string,
  responseBody?: unknown,
): EvolutionAcaoLogDerivado | undefined {
  if (!responseBody || typeof responseBody !== "object") return undefined;

  if (tipo === "instance_status") {
    const estado = parseGoConnectionState(responseBody as EvolutionGoStatusResponse);
    return { estado, conectado: estado === "open" };
  }

  if (tipo === "instance_qr") {
    const { base64 } = parseGoQrResponse(responseBody as EvolutionQrResponse);
    return { temQr: Boolean(base64) };
  }

  return undefined;
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
  const derivado = entry.derivado ?? derivarEvolutionAcaoLog(entry.tipo, entry.responseBody);

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
    derivado,
    meta: entry.meta,
  };
}

/** Grava log de ação Evolution no R2 (fire-and-forget; nunca propaga erro). */
export function putEvolutionAcaoLog(r2: R2Bucket, entry: EvolutionAcaoLogEntry): void {
  const prepared = prepararEvolutionAcaoLogEntry(entry);
  const key = buildAcaoEvolutionLogKey(
    prepared.tipo,
    new Date(prepared.at),
    prepared.meta?.instanciaUuid,
  );
  const body = JSON.stringify(prepared);

  void r2
    .put(key, body, { httpMetadata: { contentType: "application/json" } })
    .catch((err: unknown) => {
      log.warn({
        evolution: {
          acaoR2Falhou: true,
          tipo: prepared.tipo,
          key,
          erro: err instanceof Error ? err.message : String(err),
        },
      });
    });
}
