/** Remove tudo que não for dígito. */
export function somenteDigitos(valor: string): string {
  return valor.replace(/\D/g, "");
}

function digitoVerificadorCnpj(base: string, pesos: number[]): number {
  const soma = pesos.reduce((acc, peso, i) => acc + Number(base[i]) * peso, 0);
  const resto = soma % 11;
  return resto < 2 ? 0 : 11 - resto;
}

/**
 * Valida CNPJ brasileiro (14 dígitos + dígitos verificadores).
 * Aceita máscara; compara só os dígitos.
 */
export function cnpjValido(valor: string): boolean {
  const cnpj = somenteDigitos(valor);
  if (cnpj.length !== 14) return false;
  if (/^(\d)\1+$/.test(cnpj)) return false;

  const pesos1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  const pesos2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  const d1 = digitoVerificadorCnpj(cnpj.slice(0, 12), pesos1);
  const d2 = digitoVerificadorCnpj(cnpj.slice(0, 12) + String(d1), pesos2);
  return cnpj.endsWith(`${d1}${d2}`);
}

/**
 * WhatsApp de contato BR: DDD + número (10/11) ou com país 55 (12/13 dígitos).
 */
export function telefoneWhatsappBrValido(valor: string): boolean {
  const d = somenteDigitos(valor);
  if (d.startsWith("55") && (d.length === 12 || d.length === 13)) {
    const local = d.slice(2);
    return local.length === 10 || local.length === 11;
  }
  return d.length === 10 || d.length === 11;
}

/**
 * Garante DDI 55 e, em celular BR, o 9º dígito após o DDD.
 *
 * WhatsApp aceita `55418300844` e `554198300844` como o mesmo número; gravamos
 * sempre a forma com 9 (13 dígitos) para identidade estável em `contato`.
 * Fixo (assinante 2–5) permanece sem o 9.
 */
export function normalizarTelefoneWhatsappBr(valor: string): string {
  const d = somenteDigitos(valor);
  if (!d) return d;

  const com55 = d.startsWith("55") ? d : d.length === 10 || d.length === 11 ? `55${d}` : d;

  if (com55.length !== 12 || !com55.startsWith("55")) return com55;

  const ddd = com55.slice(2, 4);
  const assinante = com55.slice(4); // 8 dígitos
  // Celular antigo (sem 9): assinante começa em 6–9.
  if (/^[6-9]/.test(assinante)) {
    return `55${ddd}9${assinante}`;
  }
  return com55;
}

/**
 * Formas equivalentes do mesmo WhatsApp BR (com e sem 9º dígito).
 * Útil para lookup de contatos legados antes de criar duplicata.
 */
export function variantesTelefoneWhatsappBr(valor: string): string[] {
  const digitos = somenteDigitos(valor);
  if (!digitos) return [];

  const canon = normalizarTelefoneWhatsappBr(digitos);
  const set = new Set<string>([canon]);

  // Celular canônico 55+DDD+9+8 → também a forma sem o 9.
  if (canon.length === 13 && canon.startsWith("55") && canon[4] === "9") {
    set.add(`55${canon.slice(2, 4)}${canon.slice(5)}`);
  }

  // Se a entrada ainda não era canônica, inclui o bruto com 55.
  const com55 = digitos.startsWith("55")
    ? digitos
    : digitos.length === 10 || digitos.length === 11
      ? `55${digitos}`
      : digitos;
  if (com55.length === 12 || com55.length === 13) set.add(com55);

  return [...set];
}

/**
 * Variantes de JID `@s.whatsapp.net` / `@c.us` para o mesmo PN BR.
 * LID, grupos e outros servidores: retorna o id original sem alterar.
 */
export function variantesIdExternoWhatsappBr(idExterno: string): string[] {
  const arroba = idExterno.indexOf("@");
  if (arroba <= 0) return [idExterno];

  const user = idExterno.slice(0, arroba);
  const server = idExterno.slice(arroba + 1).toLowerCase();
  if (server !== "s.whatsapp.net" && server !== "c.us") return [idExterno];

  return variantesTelefoneWhatsappBr(user).map((phone) => `${phone}@s.whatsapp.net`);
}

/** JID canônico `@s.whatsapp.net` a partir de telefone ou user JID. */
export function idExternoWhatsappBr(telefoneOuUser: string): string {
  const user = telefoneOuUser.includes("@")
    ? telefoneOuUser.slice(0, telefoneOuUser.indexOf("@"))
    : telefoneOuUser;
  return `${normalizarTelefoneWhatsappBr(user)}@s.whatsapp.net`;
}
