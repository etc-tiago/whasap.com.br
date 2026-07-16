import { mvpDefaults } from "@whasap/config";

import type { WebEnv } from "../types";

/** URL do webhook Meta Cloud API (`WEBHOOK_URL` + `/cloud`). */
export function urlWebhookCloud(env: Pick<WebEnv, "WEBHOOK_URL">): string {
  return `${env.WEBHOOK_URL}${mvpDefaults.meta.webhookPath}`;
}

export type ConfigWebhookCloud = {
  callbackUrl: string;
  /** UUID da conexão (`instancia.uuid`) — colado como Verify token no Meta. */
  verifyToken: string;
  campos: string[];
};

/**
 * Valores que o admin cola no console Meta (WhatsApp → Configuration → Webhook).
 * O verify token é o UUID público da conexão Whasap.
 */
export function obterConfigWebhookCloud(
  env: Pick<WebEnv, "WEBHOOK_URL">,
  instanciaUuid: string,
): ConfigWebhookCloud {
  return {
    callbackUrl: urlWebhookCloud(env),
    verifyToken: instanciaUuid,
    campos: [...mvpDefaults.meta.webhookSubscribeFields],
  };
}
