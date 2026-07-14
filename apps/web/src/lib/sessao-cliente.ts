/**
 * Cleanup do estado cliente quando a sessão acaba (logout ou UNAUTHORIZED).
 */
import type { QueryClient } from "@tanstack/react-query";

import { limparColecoesInbox, solicitarWipePersistenciaSqliteInbox } from "@/lib/inbox-db";
import { limparCachePersistido } from "@/lib/query-persist";

let limpando = false;

/**
 * Limpa Query Persist (IndexedDB), registries das collections e tenta wipe do SQLite OPFS.
 * Idempotente / reentrante-safe (evita loop query onError → clear → refetch → 401).
 */
export async function limparEstadoClienteSessao(queryClient: QueryClient): Promise<void> {
  if (limpando) return;
  limpando = true;
  try {
    limparColecoesInbox(queryClient);
    await limparCachePersistido(queryClient);
    await solicitarWipePersistenciaSqliteInbox();
  } finally {
    limpando = false;
  }
}
