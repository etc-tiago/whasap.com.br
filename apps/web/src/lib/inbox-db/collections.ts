/**
 * Factories de Query Collections da inbox (server SSOT via ORPC).
 * Opcionalmente envelopadas em `persistedCollectionOptions` (SQLite OPFS).
 *
 * Usa as mesmas `queryKey` ORPC para que `invalidateQueries` de outros
 * componentes (header, etiquetas, etc.) atualize as collections.
 */
import {
  persistedCollectionOptions,
  type PersistedCollectionPersistence,
} from "@tanstack/browser-db-sqlite-persistence";
import { queryCollectionOptions } from "@tanstack/query-db-collection";
import type { QueryClient } from "@tanstack/react-query";
import { createCollection, type Collection } from "@tanstack/react-db";

import { orpc, orpcClient, type ConversaItem, type MensagemItem } from "@/lib/orpc";

export const LIMITE_MENSAGENS_PAGINA = 40;
export const LIMITE_CONVERSAS_PAGINA = 100;

export type CursorMensagens = { antesEnviadoEm: string; antesId: string };

type RegistroCliente = {
  conversas: Map<string, Collection<ConversaItem, string>>;
  mensagens: Map<string, Collection<MensagemItem, string>>;
  /** `temMaisAntigas` da última sync/load de cada conversa. */
  temMaisAntigas: Map<string, boolean>;
};

const porCliente = new WeakMap<QueryClient, RegistroCliente>();

function registro(queryClient: QueryClient): RegistroCliente {
  let r = porCliente.get(queryClient);
  if (!r) {
    r = {
      conversas: new Map(),
      mensagens: new Map(),
      temMaisAntigas: new Map(),
    };
    porCliente.set(queryClient, r);
  }
  return r;
}

function envolverPersistencia(
  // Collection options do Query adapter — tipagem atravessa o wrapper SQLite.
  // oxlint-disable-next-line typescript/no-explicit-any -- adapter options are opaque here
  options: any,
  persistence: PersistedCollectionPersistence | null,
  schemaVersion: number,
) {
  if (!persistence) return options;
  return persistedCollectionOptions({
    ...options,
    persistence,
    schemaVersion,
  });
}

/** Collection de conversas da organização — poll 10s via Query Collection. */
export function obterColecaoConversas(
  queryClient: QueryClient,
  organizacaoHash: string,
  persistence: PersistedCollectionPersistence | null,
  epoch = 0,
): Collection<ConversaItem, string> {
  const maps = registro(queryClient);
  const cacheKey = `${organizacaoHash}:${persistence ? "sqlite" : "mem"}:${epoch}`;
  const existente = maps.conversas.get(cacheKey);
  if (existente) return existente;

  const queryKey = orpc.caixaEntrada.conversas.lista.key({
    input: { organizacaoHash },
  });

  const options = queryCollectionOptions({
    id: `inbox-conversas-${organizacaoHash}`,
    queryKey,
    queryFn: async () => {
      const itens: ConversaItem[] = [];
      let cursor: { antesUltimaMensagemEm?: string; antesId?: string } = {};
      for (;;) {
        const page = await orpcClient.caixaEntrada.conversas.lista({
          organizacaoHash,
          limite: LIMITE_CONVERSAS_PAGINA,
          ...cursor,
        });
        itens.push(...page.itens);
        if (!page.temMais || page.itens.length === 0) break;
        const last = page.itens[page.itens.length - 1]!;
        if (!last.ultimaMensagemEm) break;
        cursor = {
          antesUltimaMensagemEm: last.ultimaMensagemEm,
          antesId: last.id,
        };
      }
      return itens;
    },
    queryClient,
    getKey: (c: ConversaItem) => c.id,
    refetchInterval: 10_000,
  });

  const collection = createCollection(
    envolverPersistencia(options, persistence, 1),
  ) as unknown as Collection<ConversaItem, string>;

  maps.conversas.set(cacheKey, collection);
  return collection;
}

/**
 * Collection de mensagens da conversa.
 * `queryFn` carrega só a 1ª página (mais recentes); páginas antigas via `carregarMensagensAntigas`.
 * Evita refetch automático após load inicial para não apagar páginas writeInsert —
 * `invalidateQueries` (ex.: sync histórico) ainda força refresh da 1ª página.
 */
export function obterColecaoMensagens(
  queryClient: QueryClient,
  conversaId: string,
  persistence: PersistedCollectionPersistence | null,
  epoch = 0,
): Collection<MensagemItem, string> {
  const maps = registro(queryClient);
  const cacheKey = `${conversaId}:${persistence ? "sqlite" : "mem"}:${epoch}`;
  const existente = maps.mensagens.get(cacheKey);
  if (existente) return existente;

  const queryKey = orpc.caixaEntrada.mensagens.lista.key({
    input: { conversaId },
  });

  const options = queryCollectionOptions({
    id: `inbox-mensagens-${conversaId}`,
    queryKey,
    queryFn: async () => {
      const page = await orpcClient.caixaEntrada.mensagens.lista({
        conversaId,
        limite: LIMITE_MENSAGENS_PAGINA,
      });
      maps.temMaisAntigas.set(conversaId, page.temMaisAntigas);
      return page.itens;
    },
    queryClient,
    getKey: (m: MensagemItem) => m.id,
    staleTime: Number.POSITIVE_INFINITY,
    refetchInterval: false,
  });

  const collection = createCollection(
    envolverPersistencia(options, persistence, 2),
  ) as unknown as Collection<MensagemItem, string>;

  maps.mensagens.set(cacheKey, collection);
  return collection;
}

export function lerTemMaisAntigas(queryClient: QueryClient, conversaId: string): boolean {
  return registro(queryClient).temMaisAntigas.get(conversaId) ?? false;
}

/** Upsert da página recente sem limpar mensagens mais antigas já carregadas. */
export async function sincronizarMensagensRecentes(
  queryClient: QueryClient,
  collection: Collection<MensagemItem, string>,
  conversaId: string,
): Promise<void> {
  const page = await orpcClient.caixaEntrada.mensagens.lista({
    conversaId,
    limite: LIMITE_MENSAGENS_PAGINA,
  });
  registro(queryClient).temMaisAntigas.set(conversaId, page.temMaisAntigas);
  collection.utils.writeBatch(() => {
    for (const m of page.itens) {
      collection.utils.writeUpsert(m);
    }
  });
}

/** Carrega página mais antiga e faz writeInsert (infinite scroll). */
export async function carregarMensagensAntigas(
  queryClient: QueryClient,
  collection: Collection<MensagemItem, string>,
  conversaId: string,
  cursor: CursorMensagens,
): Promise<{ temMaisAntigas: boolean }> {
  const page = await orpcClient.caixaEntrada.mensagens.lista({
    conversaId,
    limite: LIMITE_MENSAGENS_PAGINA,
    ...cursor,
  });
  registro(queryClient).temMaisAntigas.set(conversaId, page.temMaisAntigas);
  collection.utils.writeBatch(() => {
    for (const m of page.itens) {
      collection.utils.writeInsert(m);
    }
  });
  return { temMaisAntigas: page.temMaisAntigas };
}

export function inserirMensagemLocal(
  collection: Collection<MensagemItem, string>,
  mensagem: MensagemItem,
): void {
  collection.utils.writeUpsert(mensagem);
}

/** Descarta registries de collections (logout). */
export function limparColecoesInbox(queryClient: QueryClient): void {
  porCliente.delete(queryClient);
}
