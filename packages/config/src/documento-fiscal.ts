/** Remove tudo que não for dígito. */
export function somenteDigitos(valor: string): string {
  return valor.replace(/\D/g, "");
}

/**
 * Valida CNPJ brasileiro (14 dígitos + dígitos verificadores).
 * Aceita máscara; compara só os dígitos.
 */
export function cnpjValido(valor: string): boolean {
  const cnpj = somenteDigitos(valor);
  if (cnpj.length !== 14) return false;
  if (/^(\d)\1+$/.test(cnpj)) return false;

  const calc = (base: string, pesos: number[]) => {
    const soma = pesos.reduce((acc, peso, i) => acc + Number(base[i]) * peso, 0);
    const resto = soma % 11;
    return resto < 2 ? 0 : 11 - resto;
  };

  const pesos1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  const pesos2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  const d1 = calc(cnpj.slice(0, 12), pesos1);
  const d2 = calc(cnpj.slice(0, 12) + String(d1), pesos2);
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

/** Normaliza para E.164 sem `+` (sempre com 55). */
export function normalizarTelefoneWhatsappBr(valor: string): string {
  const d = somenteDigitos(valor);
  if (d.startsWith("55")) return d;
  return `55${d}`;
}
