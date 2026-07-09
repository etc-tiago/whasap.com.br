import { getEvolutionCredentials } from "@whasap/api-core";
import { mvpDefaults } from "@whasap/config";
import {
  createEvolutionGoClient,
  EVOLUTION_WEBHOOK_SUBSCRIBE_ALL,
} from "@whasap/evolution";
import { log } from "@whasap/evlog";

import type { WebEnv } from "../types";

/** URL do webhook Evolution (`WEBHOOK_URL` + `/evo`). */
export function urlWebhookEvolution(env: Pick<WebEnv, "WEBHOOK_URL">): string {
  return `${env.WEBHOOK_URL}${mvpDefaults.evolution.webhookPath}`;
}

/**
 * Configura URL e todos os eventos de webhook na instância Evolution após pareamento via QR.
 * Usa `immediate: true` para não reiniciar a sessão já conectada.
 */
export async function configurarWebhookInstanciaEvolution(
  env: WebEnv,
  instanceToken: string,
): Promise<void> {
  try {
    const creds = await getEvolutionCredentials(env);
    const client = createEvolutionGoClient(creds, { instanceToken });
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
