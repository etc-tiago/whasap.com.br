/** Extrai o nome sugerido da parte local do e-mail (antes do @). */
export function derivarNomeDoEmail(email: string): string {
  const local = email.split("@")[0]?.trim();
  return local && local.length >= 2 ? local : email;
}

/** Mascara e-mail para exibição (ex.: ti****@gmail.com). */
export function mascararEmail(email: string): string {
  const [local, domain] = email.split("@");
  if (!local || !domain) return email;
  if (local.length <= 2) return `${local[0] ?? ""}*@${domain}`;
  return `${local.slice(0, 2)}${"*".repeat(Math.min(local.length - 2, 6))}@${domain}`;
}
