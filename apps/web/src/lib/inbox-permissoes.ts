/**
 * Regras de permissão da caixa de entrada no frontend.
 * Devem espelhar validações do backend (`caixaEntradaHandlers`).
 */

type Papel = "admin" | "usuario" | "analista";

/**
 * Admin envia em qualquer conversa.
 * Usuario só envia na conversa atribuída a si (ou sem atribuição).
 * Analista nunca envia (somente leitura).
 */
export function podeEnviarMensagem(params: {
  papel: Papel | undefined;
  usuarioId: string | undefined;
  conversaAtribuidaId: string | null | undefined;
}): boolean {
  const { papel, usuarioId, conversaAtribuidaId } = params;
  if (papel === "admin") return true;
  if (papel === "usuario") {
    return !conversaAtribuidaId || conversaAtribuidaId === usuarioId;
  }
  return false;
}

/**
 * Cloud API exige janela de 24h aberta para mensagens livres (fora de template).
 */
export function janelaCloudAberta(janelaCloudExpiraEm: string | null | undefined): boolean {
  if (!janelaCloudExpiraEm) return false;
  return new Date(janelaCloudExpiraEm) > new Date();
}
