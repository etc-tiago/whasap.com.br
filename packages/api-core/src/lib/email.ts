import type { BaseEnv } from "../types";

export async function sendOtpEmail(
  env: BaseEnv,
  to: string,
  code: string,
  purpose: string,
): Promise<void> {
  const subject =
    purpose === "signup"
      ? "Seu código de cadastro — Whasap"
      : purpose === "invite"
        ? "Convite para o Whasap"
        : purpose === "office_login"
          ? "Seu código de acesso — Whasap Office"
          : "Seu código de acesso — Whasap";

  const body = `Seu código Whasap: ${code}\n\nVálido por 10 minutos. Não compartilhe este código.`;

  if (env.EMAIL_FROM.includes("localhost") || !env.EMAIL_FROM) {
    console.info(`[email:dev] To: ${to} | ${subject} | ${code}`);
    return;
  }

  console.info(`[email] Would send to ${to}: ${subject}`);
  void body;
}

export async function sendInviteEmail(
  env: BaseEnv,
  to: string,
  orgName: string,
  inviteUrl: string,
): Promise<void> {
  const subject = `Convite para ${orgName} — Whasap`;
  const body = `Você foi convidado para participar de ${orgName} no Whasap.\n\nAceite o convite: ${inviteUrl}\n\nO link expira em 7 dias.`;

  if (env.EMAIL_FROM.includes("localhost") || !env.EMAIL_FROM) {
    console.info(`[email:dev] To: ${to} | ${subject} | ${inviteUrl}`);
    return;
  }

  console.info(`[email] Would send invite to ${to}: ${subject}`);
  void body;
}
