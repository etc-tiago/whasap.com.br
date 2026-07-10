import { log } from "@whasap/evlog";
import type { BaseEnv } from "../types";

type EmailPayload = {
  to: string;
  subject: string;
  text: string;
  html: string;
  meta?: Record<string, unknown>;
};

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

async function enviarEmailTransacional(env: BaseEnv, payload: EmailPayload): Promise<void> {
  const { to, subject, text, html, meta } = payload;

  if (env.EMAIL_FROM.includes("localhost") || !env.EMAIL_FROM || !env.EMAIL) {
    log.info({ email: { dev: true, to, subject, ...meta } });
    log.info({ email: { devCorpo: text } });
    return;
  }

  const result = await env.EMAIL.send({
    to,
    from: { email: env.EMAIL_FROM, name: "Whasap" },
    subject,
    text,
    html,
  });

  log.info({ email: { to, subject, messageId: result.messageId, enviado: true, ...meta } });
}

export async function sendOtpEmail(
  env: BaseEnv,
  to: string,
  code: string,
  purpose: string,
  options?: { magicLinkUrl?: string },
): Promise<void> {
  const subject =
    purpose === "signup"
      ? "Seu código de cadastro — Whasap"
      : purpose === "invite"
        ? "Seu código de convite — Whasap"
        : purpose === "office_login"
          ? "Seu código de acesso — Whasap Office"
          : "Seu código de acesso — Whasap";

  const magicLinkUrl = options?.magicLinkUrl;
  const linkText = magicLinkUrl ? `\n\nOu acesse diretamente: ${magicLinkUrl}` : "";
  const linkHtml = magicLinkUrl
    ? `<p>Ou <a href="${escapeHtml(magicLinkUrl)}">acesse diretamente</a> sem digitar o código.</p>`
    : "";

  const text = `Seu código Whasap: ${code}${linkText}\n\nVálido por 10 minutos. Não compartilhe este código.`;
  const html = `<p>Seu código Whasap: <strong>${escapeHtml(code)}</strong></p>${linkHtml}<p>Válido por 10 minutos. Não compartilhe este código.</p>`;

  await enviarEmailTransacional(env, {
    to,
    subject,
    text,
    html,
    meta: { purpose, magicLinkUrl },
  });
}

export async function sendInviteEmail(
  env: BaseEnv,
  to: string,
  orgName: string,
  inviteUrl: string,
): Promise<void> {
  const subject = `Convite para ${orgName} — Whasap`;
  const text = `Você foi convidado para participar de ${orgName} no Whasap.\n\nAceite o convite: ${inviteUrl}\n\nO link expira em 7 dias.`;
  const html = `<p>Você foi convidado para participar de <strong>${escapeHtml(orgName)}</strong> no Whasap.</p><p><a href="${escapeHtml(inviteUrl)}">Aceitar convite</a></p><p>O link expira em 7 dias.</p>`;

  await enviarEmailTransacional(env, {
    to,
    subject,
    text,
    html,
    meta: { tipo: "invite", orgName, inviteUrl },
  });
}
