import type { EvolutionConnectionState, EvolutionQrResponse } from "./types";

export type EvolutionGoStatusData = {
  state?: EvolutionConnectionState | string;
  status?: string;
  Connected?: boolean;
  LoggedIn?: boolean;
  connected?: boolean;
  loggedIn?: boolean;
  Name?: string;
  jid?: string;
  pushName?: string;
};

export type EvolutionGoStatusResponse = {
  state?: EvolutionConnectionState | string;
  status?: string;
  connected?: boolean;
  message?: string;
  data?: EvolutionGoStatusData;
};

export type EvolutionConnectionUpdatePayload = {
  event?: string;
  data?: {
    state?: string;
    status?: string;
    Connected?: boolean;
    LoggedIn?: boolean;
    connected?: boolean;
    loggedIn?: boolean;
    jid?: string;
    pushName?: string;
    reason?: string;
    Reason?: number | string;
  };
};

function isBaileysState(value: unknown): value is EvolutionConnectionState {
  return value === "open" || value === "close" || value === "connecting";
}

function readGoBooleans(data: EvolutionGoStatusData | undefined) {
  const connected = data?.Connected ?? data?.connected;
  const loggedIn = data?.LoggedIn ?? data?.loggedIn;
  return { connected, loggedIn };
}

/**
 * Normaliza estado de conexão a partir de `GET /instance/status` (Evolution GO).
 * Suporta strings Baileys (`open`/`close`/`connecting`) e booleans `Connected`/`LoggedIn`.
 */
export function parseGoConnectionState(res: EvolutionGoStatusResponse): EvolutionConnectionState {
  const state = res.state ?? res.data?.state ?? res.status ?? res.data?.status;
  if (isBaileysState(state)) return state;

  const { connected, loggedIn } = readGoBooleans(res.data);
  if (loggedIn === true) return "open";
  if (connected === false) return "close";
  if (connected === true && loggedIn === false) return "connecting";

  if (res.connected === true) return "open";
  return "connecting";
}

/**
 * Normaliza `connection.update` do webhook Evolution (Baileys + booleans GO).
 * Também reconhece o evento dedicado `Disconnected` do Evolution GO (data vazio).
 */
export function parseConnectionUpdateWebhook(
  payload: EvolutionConnectionUpdatePayload,
): EvolutionConnectionState | null {
  if (payload.event === "Disconnected") return "close";

  const state = payload.data?.state;
  if (isBaileysState(state)) return state;

  const { connected, loggedIn } = readGoBooleans(payload.data);
  if (loggedIn === true) return "open";
  if (connected === false) return "close";
  if (connected === true && loggedIn === false) return "connecting";

  return null;
}

/**
 * Evento GO `Disconnected` — sessão caiu; `data` costuma vir vazio.
 * @returns `"close"` quando o evento é Disconnected; senão `null`.
 */
export function parseGoDisconnectedEvent(payload: { event?: string }): "close" | null {
  return payload.event === "Disconnected" ? "close" : null;
}

/**
 * Evento GO `Connected` — sessão aberta (`data.status: "open"` + jid).
 * @returns `"open"` quando o evento é Connected; senão `null`.
 */
export function parseGoConnectedEvent(payload: EvolutionConnectionUpdatePayload): "open" | null {
  if (payload.event !== "Connected") return null;
  const status = payload.data?.status ?? payload.data?.state;
  if (status === "close") return null;
  return "open";
}

/**
 * Evento GO `LoggedOut` — logout / sessão invalidada.
 * @returns `"close"` quando o evento é LoggedOut; senão `null`.
 */
export function parseGoLoggedOutEvent(payload: { event?: string }): "close" | null {
  return payload.event === "LoggedOut" ? "close" : null;
}

/**
 * Normaliza eventos de ciclo de vida de conexão do Evolution GO + Baileys.
 * Cobre `Connected`, `Disconnected`, `LoggedOut` e `connection.update`.
 */
export function parseGoConnectionLifecycleEvent(
  payload: EvolutionConnectionUpdatePayload,
): EvolutionConnectionState | null {
  const connected = parseGoConnectedEvent(payload);
  if (connected) return connected;
  if (parseGoDisconnectedEvent(payload) || parseGoLoggedOutEvent(payload)) return "close";
  if (payload.event === "connection.update" || payload.event === undefined) {
    return parseConnectionUpdateWebhook(payload);
  }
  return null;
}

/** Normaliza resposta de `/instance/qr` (GO: `qr` pipe, `data.qrcode`, `base64`, `code`). */
export function parseGoQrResponse(res: EvolutionQrResponse) {
  const qrField = res.qr ?? res.data?.qr;
  if (typeof qrField === "string" && qrField.includes("|")) {
    const [base64Part, codePart] = qrField.split("|", 2);
    return {
      base64: base64Part || null,
      pairingCode: codePart || null,
    };
  }

  const base64 =
    (typeof qrField === "string" ? qrField : null) ??
    res.data?.qrcode ??
    res.data?.base64 ??
    res.base64 ??
    null;

  const pairingCode =
    res.data?.pairingCode ?? res.pairingCode ?? res.data?.code ?? res.code ?? null;

  return { base64, pairingCode };
}
