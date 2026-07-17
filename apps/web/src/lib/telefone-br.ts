import {
  normalizarTelefoneWhatsappBr,
  variantesTelefoneWhatsappBr,
} from "@whasap/config";

/** Extrai apenas dígitos de um valor de telefone. */
export function digitosTelefone(valor: string): string {
  return valor.replace(/\D/g, "");
}

/**
 * Normaliza telefone pt-BR para dígitos com DDI 55 e 9º dígito em celular.
 * Alinhado a `normalizarTelefoneWhatsappBr` (@whasap/config).
 */
export function normalizarTelefoneBr(valor: string): string {
  return normalizarTelefoneWhatsappBr(valor);
}

/** Indica se o valor, após extrair dígitos, parece um telefone pt-BR (10–13 dígitos). */
export function eCandidatoTelefoneBr(valor: string): boolean {
  const digitos = digitosTelefone(valor);
  return digitos.length >= 10 && digitos.length <= 13;
}

/** Compara dois telefones após canonicalização (com/sem 9º dígito = iguais). */
export function telefonesBrIguais(a: string, b: string): boolean {
  const na = normalizarTelefoneWhatsappBr(a);
  const nb = normalizarTelefoneWhatsappBr(b);
  return na.length > 0 && na === nb;
}

/** Variantes com/sem 9º dígito — busca de contato legado na UI. */
export function variantesTelefoneBr(valor: string): string[] {
  return variantesTelefoneWhatsappBr(valor);
}
