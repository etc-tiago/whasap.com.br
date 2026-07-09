/** Rótulos de status de instância WhatsApp para exibição no painel. */
export const rotulosStatusInstancia: Record<string, string> = {
  pending_connection: "Configurando",
  pending_payment: "Aguardando pagamento",
  provisioning: "Provisionando",
  disconnected: "Desconectada",
  connected: "Conectada",
  deactivated: "Desativada",
};

/** Instância ainda não conectada e elegível para fluxo de pareamento/reconexão. */
export function instanciaPrecisaConexao(status: string): boolean {
  return status !== "connected" && status !== "deactivated";
}

/** Filtra instâncias que podem entrar no onboarding de reconexão. */
export function instanciasParaReconectar<T extends { status: string }>(instancias: T[]): T[] {
  return instancias.filter((i) => instanciaPrecisaConexao(i.status));
}
