/**
 * Persistência seletiva do TanStack Query (IndexedDB) para first paint da inbox.
 * Server/Postgres permanece SSOT — o cache local só acelera a hidratação inicial.
 */
import { createAsyncStoragePersister } from "@tanstack/query-async-storage-persister";
import { defaultShouldDehydrateQuery, type Query, type QueryClient } from "@tanstack/react-query";
import type { Persister } from "@tanstack/react-query-persist-client";
import { del, get, set } from "idb-keyval";

/** Alinhado ao `gcTime` do QueryClient — cache persistido descartado após 24h. */
export const QUERY_PERSIST_MAX_AGE_MS = 1000 * 60 * 60 * 24;

/** Incrementar ao mudar allowlist / shape dos payloads persistidos. */
export const QUERY_PERSIST_BUSTER = "whasap-web-rq-v1";

const IDB_KEY = "whasap-web-rq";

/**
 * Prefixos elegíveis a dehydrate.
 * Query Collections usam as mesmas keys ORPC de conversas/mensagens.
 */
const ALLOWLIST_PREFIXOS: readonly (readonly string[])[] = [
  ["caixaEntrada", "conversas", "lista"],
  ["caixaEntrada", "mensagens", "lista"],
  ["organizacao", "obter"],
  ["instancia", "lista"],
];

/**
 * Extrai path elegível a allowlist.
 * - ORPC / Query Collection: `[["caixaEntrada","conversas","lista"], { input }]`
 * - Keys flat (string[]): usadas em testes / fallbacks
 */
export function caminhoQueryKeyOrpc(queryKey: readonly unknown[]): string[] | null {
  const head = queryKey[0];
  if (
    Array.isArray(head) &&
    head.length > 0 &&
    head.every((p): p is string => typeof p === "string")
  ) {
    return head;
  }
  if (queryKey.length > 0 && queryKey.every((p): p is string => typeof p === "string")) {
    return [...queryKey];
  }
  return null;
}

/** True se o path ORPC começa com algum prefixo da allowlist. */
export function caminhoNaAllowlistPersist(
  caminho: readonly string[],
  allowlist: readonly (readonly string[])[] = ALLOWLIST_PREFIXOS,
): boolean {
  return allowlist.some(
    (prefixo) => prefixo.length <= caminho.length && prefixo.every((p, i) => caminho[i] === p),
  );
}

/**
 * Dehydrate só queries bem-sucedidas da allowlist da inbox.
 * Evita QR, mídia upload, OTP, heartbeat, etc.
 */
export function shouldDehydrateInboxQuery(query: Query): boolean {
  if (!defaultShouldDehydrateQuery(query)) return false;
  const caminho = caminhoQueryKeyOrpc(query.queryKey);
  if (!caminho) return false;
  return caminhoNaAllowlistPersist(caminho);
}

function criarPersisterIdb(): Persister {
  return createAsyncStoragePersister({
    key: IDB_KEY,
    storage: {
      getItem: async (key) => {
        const valor = await get<string>(key);
        return valor ?? null;
      },
      setItem: async (key, value) => {
        await set(key, value);
      },
      removeItem: async (key) => {
        await del(key);
      },
    },
  });
}

function criarPersisterNoop(): Persister {
  return {
    persistClient: async () => {},
    restoreClient: async () => undefined,
    removeClient: async () => {},
  };
}

/** Persister IndexedDB no browser; noop em ambientes sem `window` (build/SSR). */
export const queryPersister: Persister =
  typeof window !== "undefined" ? criarPersisterIdb() : criarPersisterNoop();

/** Opções padrão do `PersistQueryClientProvider`. */
export const queryPersistOptions = {
  persister: queryPersister,
  maxAge: QUERY_PERSIST_MAX_AGE_MS,
  buster: QUERY_PERSIST_BUSTER,
  dehydrateOptions: {
    shouldDehydrateQuery: shouldDehydrateInboxQuery,
  },
} as const;

/**
 * Limpa memória + IndexedDB do cache ORPC (logout / troca de sessão).
 */
export async function limparCachePersistido(queryClient: QueryClient): Promise<void> {
  queryClient.clear();
  await queryPersister.removeClient();
}
