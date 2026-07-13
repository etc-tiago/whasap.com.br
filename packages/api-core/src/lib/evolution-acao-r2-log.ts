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

export type ProvedorAcao = "evo" | "meta_cloud";

export type EvolutionAcaoLogDerivado = {
  estado?: string;
  conectado?: boolean;
  temQr?: boolean;
};

/** Entrada canônica R2 `acao/` (formato nested). */
export type ProvedorAcaoLogEntry = {
  at: string;
  provedor: ProvedorAcao;
  acao: string;
  request: {
    url: string;
    tipo: string;
    body?: unknown;
  };
  response: {
    status: number | null;
    body?: unknown;
    error?: string | null;
    durationMs: number;
  };
  derivado?: EvolutionAcaoLogDerivado;
  meta?: Record<string, string>;
};

/** @deprecated Preferir ProvedorAcaoLogEntry — mantido para imports legados em testes. */
export type EvolutionAcaoLogEntry = ProvedorAcaoLogEntry;

function sanitizeSegment(value: string): string {
  return value.replace(/[^a-zA-Z0-9._-]+/g, "_").slice(0, 120) || "unknown";
}

/**
 * Chave R2 de ação provedor.
 * Com instancia: `acao/{provedor}/{instanciaUuid}/{acao}/{YYYY-MM-DD}/{HH-mm-ss}.{uuid}.json`
 * Sem: `acao/{provedor}/{acao}/{YYYY-MM-DD}/{HH-mm-ss}.{uuid}.json`
 */
export function buildAcaoProvedorLogKey(
  provedor: ProvedorAcao,
  acao: string,
  at = new Date(),
  instanciaUuid?: string,
): string {
  const date = at.toISOString().slice(0, 10);
  const time = at.toISOString().slice(11, 19).replace(/:/g, "-");
  const id = crypto.randomUUID();
  const arquivo = `${time}.${id}.json`;
  const provedorSeg = sanitizeSegment(provedor);
  const acaoSeg = sanitizeSegment(acao);
  if (instanciaUuid) {
    return `acao/${provedorSeg}/${sanitizeSegment(instanciaUuid)}/${acaoSeg}/${date}/${arquivo}`;
  }
  return `acao/${provedorSeg}/${acaoSeg}/${date}/${arquivo}`;
}

/** @deprecated Use buildAcaoProvedorLogKey("evo", ...). */
export function buildAcaoEvolutionLogKey(
  tipo: string,
  at = new Date(),
  instanciaUuid?: string,
): string {
  return buildAcaoProvedorLogKey("evo", tipo, at, instanciaUuid);
}

/** Redige `access_token` e similares na URL antes de persistir. */
export function redigirUrlLog(url: string): string {
  try {
    const u = new URL(url);
    for (const key of ["access_token", "apikey", "api_key", "token"]) {
      if (u.searchParams.has(key)) u.searchParams.set(key, "[redacted]");
    }
    return u.toString();
  } catch {
    return url.replace(/([?&](?:access_token|apikey|api_key|token)=)[^&]*/gi, "$1[redacted]");
  }
}

/** Deriva estado/conectado/temQr a partir da resposta Evolution para o log R2. */
export function derivarEvolutionAcaoLog(
  acao: string,
  responseBody?: unknown,
): EvolutionAcaoLogDerivado | undefined {
  if (!responseBody || typeof responseBody !== "object") return undefined;

  if (acao === "instance_status") {
    const estado = parseGoConnectionState(responseBody as EvolutionGoStatusResponse);
    return { estado, conectado: estado === "open" };
  }

  if (acao === "instance_qr") {
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

export const redigirProvedorLogPayload = redigirEvolutionLogPayload;

/** Tenta parsear texto de erro HTTP como JSON para `response.body`. */
export function parseCorpoErroHttp(texto: string | undefined): unknown {
  if (!texto) return undefined;
  try {
    return JSON.parse(texto) as unknown;
  } catch {
    return { raw: texto };
  }
}

export function prepararProvedorAcaoLogEntry(
  entry: Omit<ProvedorAcaoLogEntry, "at"> & { at?: string },
): ProvedorAcaoLogEntry {
  const responseBody = entry.response.body;
  const derivado =
    entry.derivado ??
    (entry.provedor === "evo"
      ? derivarEvolutionAcaoLog(entry.acao, responseBody)
      : undefined);

  return {
    at: entry.at ?? new Date().toISOString(),
    provedor: entry.provedor,
    acao: entry.acao,
    request: {
      url: redigirUrlLog(entry.request.url),
      tipo: entry.request.tipo,
      body:
        entry.request.body !== undefined
          ? redigirProvedorLogPayload(entry.request.body)
          : undefined,
    },
    response: {
      status: entry.response.status,
      body:
        responseBody !== undefined ? redigirProvedorLogPayload(responseBody) : undefined,
      error: entry.response.error ?? null,
      durationMs: entry.response.durationMs,
    },
    derivado,
    meta: entry.meta,
  };
}

/** @deprecated Use prepararProvedorAcaoLogEntry. */
export function prepararEvolutionAcaoLogEntry(
  entry: Omit<ProvedorAcaoLogEntry, "at"> & { at?: string },
): ProvedorAcaoLogEntry {
  return prepararProvedorAcaoLogEntry(entry);
}

/** Grava log de ação provedor no R2 (fire-and-forget; nunca propaga erro). */
export function putProvedorAcaoLog(r2: R2Bucket, entry: ProvedorAcaoLogEntry): void {
  const prepared = prepararProvedorAcaoLogEntry(entry);
  const key = buildAcaoProvedorLogKey(
    prepared.provedor,
    prepared.acao,
    new Date(prepared.at),
    prepared.meta?.instanciaUuid,
  );
  const body = JSON.stringify(prepared);

  void r2
    .put(key, body, { httpMetadata: { contentType: "application/json" } })
    .catch((err: unknown) => {
      log.warn({
        provedorAcao: {
          acaoR2Falhou: true,
          provedor: prepared.provedor,
          acao: prepared.acao,
          key,
          erro: err instanceof Error ? err.message : String(err),
        },
      });
    });
}

/** @deprecated Use putProvedorAcaoLog. */
export function putEvolutionAcaoLog(r2: R2Bucket, entry: ProvedorAcaoLogEntry): void {
  putProvedorAcaoLog(r2, entry);
}
