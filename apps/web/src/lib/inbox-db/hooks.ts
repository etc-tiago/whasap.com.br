/**
 * Hooks React para ler conversas/mensagens via TanStack DB live queries.
 */
import { useLiveQuery } from "@tanstack/react-db";
import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import type { ConversaItem, MensagemItem } from "@/lib/orpc";

import {
  carregarMensagensAntigas,
  inserirMensagemLocal,
  obterColecaoConversas,
  obterColecaoMensagens,
  lerTemMaisAntigas,
  removerMensagemLocal,
  sincronizarMensagensRecentes,
} from "./collections";
import { useInboxDb } from "./persistence";

/** Lista de conversas da org — live query + poll ORPC via Query Collection. */
export function useInboxConversas(
  organizacaoHash: string | undefined,
  arquivadas = false,
) {
  const queryClient = useQueryClient();
  const { ready, persistence, epoch } = useInboxDb();

  const collection = useMemo(() => {
    if (!ready || !organizacaoHash) return null;
    return obterColecaoConversas(
      queryClient,
      organizacaoHash,
      persistence,
      epoch,
      arquivadas,
    );
  }, [queryClient, organizacaoHash, ready, persistence, epoch, arquivadas]);

  const live = useLiveQuery(
    (q) => {
      if (!collection) return undefined;
      // Mais recente primeiro — espelha `enviadoEm` da última mensagem (`ultimaMensagemEm`).
      return q.from({ c: collection }).orderBy(({ c }) => c.ultimaMensagemEm, "desc");
    },
    [collection],
  );

  return {
    data: (live.data ?? []) as ConversaItem[],
    isPending: !ready || live.isLoading,
    isReady: ready && live.isReady,
    collection,
    refetch: () => collection?.utils.refetch(),
  };
}

/**
 * Mensagens da conversa selecionada.
 * Ordem cronológica (enviadoEm asc). Paginação antiga via writeInsert.
 */
export function useInboxMensagens(conversaId: string | null) {
  const queryClient = useQueryClient();
  const { ready, persistence, epoch } = useInboxDb();
  const [temMaisAntigas, setTemMaisAntigas] = useState(false);
  const [isFetchingNextPage, setIsFetchingNextPage] = useState(false);
  const carregandoRef = useRef(false);

  const collection = useMemo(() => {
    if (!ready || !conversaId) return null;
    return obterColecaoMensagens(queryClient, conversaId, persistence, epoch);
  }, [queryClient, conversaId, ready, persistence, epoch]);

  const live = useLiveQuery(
    (q) => {
      if (!collection) return undefined;
      return q.from({ m: collection }).orderBy(({ m }) => m.enviadoEm, "asc");
    },
    [collection],
  );

  // Sync flag temMais após o load inicial da collection.
  useEffect(() => {
    if (!conversaId || !collection || !live.isReady) return;
    setTemMaisAntigas(lerTemMaisAntigas(queryClient, conversaId));
  }, [conversaId, collection, live.isReady, live.data?.length, queryClient]);

  const mensagens = (live.data ?? []) as MensagemItem[];
  const mensagensRef = useRef(mensagens);
  mensagensRef.current = mensagens;

  const fetchNextPage = useCallback(async () => {
    if (!conversaId || !collection || carregandoRef.current || !temMaisAntigas) return;
    const oldest = mensagensRef.current[0];
    if (!oldest) return;
    carregandoRef.current = true;
    setIsFetchingNextPage(true);
    try {
      const { temMaisAntigas: mais } = await carregarMensagensAntigas(
        queryClient,
        collection,
        conversaId,
        { antesEnviadoEm: oldest.enviadoEm, antesId: oldest.id },
      );
      setTemMaisAntigas(mais);
    } finally {
      carregandoRef.current = false;
      setIsFetchingNextPage(false);
    }
  }, [conversaId, collection, temMaisAntigas, queryClient]);

  const sincronizarRecentes = useCallback(async () => {
    if (!conversaId || !collection) return;
    await sincronizarMensagensRecentes(queryClient, collection, conversaId);
    setTemMaisAntigas(lerTemMaisAntigas(queryClient, conversaId));
  }, [conversaId, collection, queryClient]);

  const anexarMensagem = useCallback(
    (mensagem: MensagemItem) => {
      if (!collection) return;
      inserirMensagemLocal(collection, mensagem);
    },
    [collection],
  );

  const removerMensagem = useCallback(
    (mensagemId: string) => {
      if (!collection) return;
      removerMensagemLocal(collection, mensagemId);
    },
    [collection],
  );

  return {
    mensagens,
    isPending: Boolean(conversaId) && (!ready || live.isLoading),
    isReady: ready && live.isReady,
    temMaisAntigas,
    isFetchingNextPage,
    fetchNextPage,
    sincronizarRecentes,
    anexarMensagem,
    removerMensagem,
    collection,
  };
}
