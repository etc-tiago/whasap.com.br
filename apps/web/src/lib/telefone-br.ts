/** Extrai apenas dígitos de um valor de telefone. */
export function digitosTelefone(valor: string): string {
  return valor.replace(/\D/g, "");
}

/**
 * Normaliza telefone pt-BR para dígitos com DDI 55 quando for número local (10/11 dígitos).
 */
export function normalizarTelefoneBr(valor: string): string {
  const digitos = digitosTelefone(valor);
  if ((digitos.length === 10 || digitos.length === 11) && !digitos.startsWith("55")) {
    return `55${digitos}`;
  }
  return digitos;
}

/** Indica se o valor, após extrair dígitos, parece um telefone pt-BR (10–13 dígitos). */
export function eCandidatoTelefoneBr(valor: string): boolean {
  const digitos = digitosTelefone(valor);
  return digitos.length >= 10 && digitos.length <= 13;
}

/** Compara dois telefones após normalização pt-BR. */
export function telefonesBrIguais(a: string, b: string): boolean {
  const na = normalizarTelefoneBr(a);
  const nb = normalizarTelefoneBr(b);
  return na.length > 0 && na === nb;
}
