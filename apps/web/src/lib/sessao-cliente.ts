/**
 * Cleanup do estado cliente quando a sessão acaba (logout ou UNAUTHORIZED).
 */
import type { QueryClient } from "@tanstack/react-query";

import { limparColecoesInbox, solicitarWipePersistenciaSqliteInbox } from "@/lib/inbox-db";
import { orpc } from "@/lib/orpc";
import { limparCachePersistido } from "@/lib/query-persist";

let limpando = false;
/** Após 401/logout: impede clear → refetch `/eu` → 401 em loop. */
let sessaoEncerrada = false;

export function sessaoClienteEncerrada(): boolean {
  return sessaoEncerrada;
}

/** Libera o latch após login bem-sucedido para voltar a consultar `/eu`. */
export function reabrirSessaoCliente(): void {
  sessaoEncerrada = false;
}

/**
 * Limpa Query Persist (IndexedDB), registries das collections e tenta wipe do SQLite OPFS.
 * Idempotente / reentrante-safe (evita loop query onError → clear → refetch → 401).
 */
export async function limparEstadoClienteSessao(queryClient: QueryClient): Promise<void> {
  if (limpando || sessaoEncerrada) return;
  limpando = true;
  sessaoEncerrada = true;
  try {
    // Cancela fetches em voo antes do clear — senão o observer de useSession
    // remonta a query e dispara outro /eu → 401 → clear…
    await queryClient.cancelQueries();
    limparColecoesInbox(queryClient);
    await limparCachePersistido(queryClient);
    await solicitarWipePersistenciaSqliteInbox();
    // Seed sem refetch: observers ativos não disparam queryFn de novo
    // (session query usa staleTime Infinity).
    queryClient.setQueryData(orpc.autenticacao.eu.key(), null);
  } catch (erro) {
    sessaoEncerrada = false;
    throw erro;
  } finally {
    limpando = false;
  }
}
