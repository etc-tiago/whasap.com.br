import { mvpDefaults } from "@whasap/config";

import type { BaseEnv } from "../types";
import { rpcError, tooManyRequests } from "./rpc-error";

const limit = mvpDefaults.auth.attemptRateLimit;
const windowSeconds = mvpDefaults.auth.attemptRateLimitWindowSeconds;
const windowMs = windowSeconds * 1000;

const devStore = new Map<string, { count: number; windowStart: number }>();

function rateLimitKey(email: string) {
  return `auth:${email.toLowerCase()}`;
}

async function consumeAttempt(env: BaseEnv, email: string): Promise<{ success: boolean }> {
  const key = rateLimitKey(email);
  const rateLimiter = env.AUTH_RATE_LIMIT;

  if (rateLimiter) {
    return rateLimiter.limit({ key });
  }

  const now = Date.now();
  const stored = devStore.get(key);
  if (!stored || now - stored.windowStart >= windowMs) {
    devStore.set(key, { count: 1, windowStart: now });
    return { success: true };
  }

  if (stored.count >= limit) {
    return { success: false };
  }

  stored.count += 1;
  devStore.set(key, stored);
  return { success: true };
}

export async function beginAuthAttempt(env: BaseEnv, email: string): Promise<void> {
  const { success } = await consumeAttempt(env, email);

  if (!success) {
    tooManyRequests(
      `Limite de ${limit} tentativas por ${windowSeconds} segundos atingido. Aguarde um momento.`,
    );
  }
}

export async function failAuthAttemptWithCode(
  env: BaseEnv,
  email: string,
  code: "NOT_FOUND" | "CONFLICT" | "TOO_MANY_REQUESTS" | "UNAUTHORIZED",
  reason: string,
): Promise<never> {
  void env;
  void email;

  rpcError(code, `${reason} Limite de ${limit} tentativas por ${windowSeconds} segundos.`);
}
