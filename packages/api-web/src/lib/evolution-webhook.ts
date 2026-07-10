import { criarClienteEvolutionGo, getEvolutionCredentials } from "@whasap/api-core";
import { mvpDefaults } from "@whasap/config";
import {
  EVOLUTION_WEBHOOK_SUBSCRIBE_ALL,
  parseGoQrResponse,
  type EvolutionQrResponse,
} from "@whasap/evolution";
import { log } from "@whasap/evlog";

import type { WebEnv } from "../types";

/** URL do webhook Evolution (`WEBHOOK_URL` + `/evo`). */
export function urlWebhookEvolution(env: Pick<WebEnv, "WEBHOOK_URL">): string {
  return `${env.WEBHOOK_URL}${mvpDefaults.evolution.webhookPath}`;
}

type ClienteEvolutionInstancia = ReturnType<typeof criarClienteEvolutionGo>;

const QR_RETRY_ATTEMPTS = 3;
const QR_RETRY_DELAY_MS = 400;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Inicia sessão de pareamento no GO (`POST /instance/connect`).
 * Sem `connect` prévio, `GET /instance/qr` costuma travar indefinidamente.
 */
export async function iniciarSessaoQr(
  client: Pick<ClienteEvolutionInstancia, "connect">,
  env: Pick<WebEnv, "WEBHOOK_URL">,
): Promise<void> {
  try {
    await client.connect({
      webhookUrl: urlWebhookEvolution(env),
      subscribe: [...EVOLUTION_WEBHOOK_SUBSCRIBE_ALL],
    });
  } catch (err) {
    log.warn({
      evolution: {
        iniciarSessaoQrFalhou: true,
        erro: err instanceof Error ? err.message : String(err),
      },
    });
  }
}

export type QrComSessaoResult = {
  base64: string | null;
  pairingCode: string | null;
  qrBruto: EvolutionQrResponse | null;
  erro: string | null;
};

/**
 * Garante sessão de pareamento (`connect`) e tenta obter QR na mesma operação.
 * Usado quando status é `close` ou `connecting` sem QR — o GO às vezes demora
 * a expor o QR logo após connect, daí o retry curto.
 */
export async function obterQrComSessao(
  client: Pick<ClienteEvolutionInstancia, "connect" | "getQrCode">,
  env: Pick<WebEnv, "WEBHOOK_URL">,
  options: { tentativas?: number; delayMs?: number } = {},
): Promise<QrComSessaoResult> {
  const tentativas = options.tentativas ?? QR_RETRY_ATTEMPTS;
  const delayMs = options.delayMs ?? QR_RETRY_DELAY_MS;

  await iniciarSessaoQr(client, env);

  async function tentar(
    tentativa: number,
    ultimoErro: string | null,
    ultimoQr: EvolutionQrResponse | null,
  ): Promise<QrComSessaoResult> {
    if (tentativa > 0) await sleep(delayMs);

    let erro = ultimoErro;
    let qrBruto = ultimoQr;

    try {
      qrBruto = await client.getQrCode();
      const { base64, pairingCode } = parseGoQrResponse(qrBruto);
      if (base64 || pairingCode) {
        return { base64, pairingCode, qrBruto, erro: null };
      }
    } catch (err) {
      erro = err instanceof Error ? err.message : String(err);
    }

    if (tentativa + 1 >= tentativas) {
      return { base64: null, pairingCode: null, qrBruto, erro };
    }

    return tentar(tentativa + 1, erro, qrBruto);
  }

  return tentar(0, null, null);
}

/**
 * Configura URL e todos os eventos de webhook na instância Evolution após pareamento via QR.
 * Usa `immediate: true` para não reiniciar a sessão já conectada.
 */
export async function configurarWebhookInstanciaEvolution(
  env: WebEnv,
  instanceToken: string,
  meta?: Record<string, string>,
): Promise<void> {
  try {
    const creds = await getEvolutionCredentials(env);
    const client = criarClienteEvolutionGo(env, creds, { instanceToken }, meta);
    await client.connect({
      webhookUrl: urlWebhookEvolution(env),
      subscribe: [...EVOLUTION_WEBHOOK_SUBSCRIBE_ALL],
      immediate: true,
    });
  } catch (err) {
    log.warn({
      evolution: {
        configurarWebhookFalhou: true,
        erro: err instanceof Error ? err.message : String(err),
      },
    });
  }
}
