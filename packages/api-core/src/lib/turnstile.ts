import type { BaseEnv } from "../types";
import { internalServerError, unauthorized } from "./rpc-error";

type TurnstileVerifyResponse = {
  success: boolean;
  "error-codes"?: string[];
};

export async function verifyTurnstile(
  env: BaseEnv,
  token: string,
  remoteIp?: string,
): Promise<void> {
  const secret = env.TURNSTILE_SECRET_KEY;
  if (!secret) {
    internalServerError("Verificação de segurança indisponível.");
  }

  const body = new URLSearchParams({
    secret,
    response: token,
  });
  if (remoteIp) {
    body.set("remoteip", remoteIp);
  }

  const response = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body,
  });

  if (!response.ok) {
    internalServerError("Não foi possível validar a verificação de segurança.");
  }

  const result = (await response.json()) as TurnstileVerifyResponse;
  if (!result.success) {
    unauthorized("Verificação de segurança inválida. Atualize a página e tente novamente.");
  }
}

export function getClientIp(request: Request): string | undefined {
  return (
    request.headers.get("CF-Connecting-IP") ??
    request.headers.get("X-Forwarded-For")?.split(",")[0]?.trim() ??
    undefined
  );
}
