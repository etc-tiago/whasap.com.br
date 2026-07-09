import { criarClienteEvolutionGo, getEvolutionCredentials } from "@whasap/api-core";
import { mvpDefaults } from "@whasap/config";
import { EVOLUTION_WEBHOOK_SUBSCRIBE_ALL, type EvolutionConnectionState } from "@whasap/evolution";
import { log } from "@whasap/evlog";

import type { WebEnv } from "../types";

/** URL do webhook Evolution (`WEBHOOK_URL` + `/evo`). */
export function urlWebhookEvolution(env: Pick<WebEnv, "WEBHOOK_URL">): string {
  return `${env.WEBHOOK_URL}${mvpDefaults.evolution.webhookPath}`;
}

type ClienteEvolutionInstancia = ReturnType<typeof criarClienteEvolutionGo>;

/**
 * Inicia sessão de pareamento no GO quando status está `close`.
 * Sem `connect` prévio, `GET /instance/qr` costuma travar indefinidamente.
 */
export async function iniciarSessaoQrSeNecessario(
  client: ClienteEvolutionInstancia,
  env: Pick<WebEnv, "WEBHOOK_URL">,
  estado: EvolutionConnectionState,
): Promise<void> {
  if (estado !== "close") return;

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
