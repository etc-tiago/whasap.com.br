/**
 * Caixa de entrada estilo WhatsApp Web — lista unificada por organização.
 *
 * Dados de conversas/mensagens via TanStack DB (Query Collection + live query);
 * server/Postgres continua SSOT via ORPC. Search: `conversa` seleciona thread;
 * `telefone`+`instancia` abrem nova conversa (ex.: Contatos).
 */
import { skipToken, useMutation, useQuery } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { isEvoProvider, isMetaCloudProvider } from "@whasap/config";
import { Badge } from "@whasap/ui/components/badge";
import { Loader2 } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

import { WaChatHeader } from "@/components/inbox/wa-chat-header";
import type { FiltroConversa } from "@/components/inbox/wa-chat-list-panel";
import { WaChatRow } from "@/components/inbox/wa-chat-row";
import {
  WaComposer,
  type ItemFilaRespostaRapida,
  type MidiaAnexada,
} from "@/components/inbox/wa-composer";
import { WaMessageArea } from "@/components/inbox/wa-message-area";
import { WaShell } from "@/components/inbox/wa-shell";
import { useSession } from "@/lib/auth";
import { useInboxConversas, useInboxMensagens } from "@/lib/inbox-db";
import { IconeConexaoLucide } from "@/lib/icones-conexao";
import { janelaCloudAberta, podeEnviarMensagem } from "@/lib/inbox-permissoes";
import { formatarHorarioConversa, formatarPreviewMensagem } from "@/lib/inbox-utils";
import { instanciaOperacional } from "@/lib/instancia-status";
import { orgInput } from "@/lib/org-input";
import { orpc, type ConversaItem } from "@/lib/orpc";
import { eCandidatoTelefoneBr, normalizarTelefoneBr, telefonesBrIguais } from "@/lib/telefone-br";
import { useOrganizacaoHash } from "@/lib/use-organizacao-hash";

type InboxSearch = {
  conversa?: string;
  telefone?: string;
  instancia?: string;
};

export const Route = createFileRoute("/_panel/$organizacaoHash/inbox/")({
  validateSearch: (s: Record<string, unknown>): InboxSearch => ({
    conversa: typeof s.conversa === "string" && s.conversa ? s.conversa : undefined,
    telefone: typeof s.telefone === "string" && s.telefone ? s.telefone : undefined,
    instancia: typeof s.instancia === "string" && s.instancia ? s.instancia : undefined,
  }),
  component: InboxOrgPage,
});

function InboxOrgPage() {
  const navigate = useNavigate();
  const organizacaoHash = useOrganizacaoHash();
  const search = Route.useSearch();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [busca, setBusca] = useState("");
  const [filtroAtivo, setFiltroAtivo] = useState<FiltroConversa>("Tudo");
  const [message, setMessage] = useState("");
  const [midia, setMidia] = useState<MidiaAnexada | null>(null);
  const [filaRespostaRapida, setFilaRespostaRapida] = useState<ItemFilaRespostaRapida[] | null>(
    null,
  );
  const [iniciarConversaExterna, setIniciarConversaExterna] = useState<{
    telefone: string;
    instanciaId?: string;
  } | null>(null);
  const [forcarRodapeToken, setForcarRodapeToken] = useState(0);
  const ultimaMensagemEmRef = useRef<string | null>(null);

  const { data: session } = useSession();

  useEffect(() => {
    if (search.conversa) {
      setSelectedId(search.conversa);
    }
  }, [search.conversa]);

  useEffect(() => {
    if (!search.telefone) return;
    setIniciarConversaExterna({
      telefone: search.telefone,
      instanciaId: search.instancia,
    });
  }, [search.telefone, search.instancia]);

  function limparSearchInbox() {
    if (!organizacaoHash) return;
    if (!search.conversa && !search.telefone && !search.instancia) return;
    void navigate({
      to: "/$organizacaoHash/inbox",
      params: { organizacaoHash },
      search: {},
      replace: true,
    });
  }

  const org = useQuery(
    orpc.organizacao.obter.queryOptions({
      input: orgInput(organizacaoHash),
    }),
  );

  const instancias = useQuery(
    orpc.instancia.lista.queryOptions({
      input: orgInput(organizacaoHash),
    }),
  );

  const conversations = useInboxConversas(organizacaoHash);

  const selected = conversations.data.find((c: ConversaItem) => c.id === selectedId);
  const instanciasOperacionais = useMemo(
    () => (instancias.data ?? []).filter((i) => instanciaOperacional(i.status)),
    [instancias.data],
  );
  const instanciaAtivaId = selected?.instanciaId ?? instanciasOperacionais[0]?.id;
  const instanciaPadraoNovaConversa = useMemo(() => {
    if (
      selected?.instanciaId &&
      instanciasOperacionais.some((i) => i.id === selected.instanciaId)
    ) {
      return selected.instanciaId;
    }
    return instanciasOperacionais[0]?.id;
  }, [selected?.instanciaId, instanciasOperacionais]);
  const instanciasParaNovaConversa = useMemo(
    () =>
      instanciasOperacionais.map((i) => ({
        id: i.id,
        nome: i.nome,
        icone: i.icone,
        provider: i.provider,
      })),
    [instanciasOperacionais],
  );

  const instance = useQuery(
    orpc.instancia.obter.queryOptions({
      input: instanciaAtivaId ? { instanciaId: instanciaAtivaId } : skipToken,
    }),
  );

  const midiaSyncDisparado = useRef(new Set<string>());
  const midiaRefetchTentativas = useRef(new Map<string, number>());
  const sincronizarHistoricoMidia = useMutation(
    orpc.caixaEntrada.conversas.sincronizarHistorico.mutationOptions({}),
  );

  const {
    mensagens,
    temMaisAntigas,
    isFetchingNextPage,
    fetchNextPage,
    sincronizarRecentes,
    anexarMensagem,
  } = useInboxMensagens(selectedId);

  useEffect(() => {
    ultimaMensagemEmRef.current = null;
  }, [selectedId]);

  useEffect(() => {
    if (!selectedId) return;
    const atual = conversations.data.find((c) => c.id === selectedId)?.ultimaMensagemEm ?? null;
    const anterior = ultimaMensagemEmRef.current;
    if (anterior !== null && atual !== null && atual !== anterior) {
      void sincronizarRecentes();
    }
    ultimaMensagemEmRef.current = atual;
  }, [selectedId, conversations.data, sincronizarRecentes]);

  useEffect(() => {
    if (!selectedId || mensagens.length === 0) return;
    const conversa = conversations.data.find((c) => c.id === selectedId);
    if (!conversa) return;
    const instanciaRow = instancias.data?.find((i) => i.id === conversa.instanciaId);
    if (!instanciaRow || !isEvoProvider(instanciaRow.provider)) return;

    const midiaPendente = mensagens.some(
      (m) => ["image", "video", "audio", "document", "sticker"].includes(m.type) && !m.mediaUrl,
    );
    if (!midiaPendente) return;
    if (midiaSyncDisparado.current.has(selectedId)) return;

    midiaSyncDisparado.current.add(selectedId);
    sincronizarHistoricoMidia.mutate({ conversaId: selectedId });
  }, [selectedId, mensagens, conversations.data, instancias.data, sincronizarHistoricoMidia]);

  // Poll curto enquanto houver mídia sem URL (substitui refetchInterval do infinite query).
  useEffect(() => {
    if (!selectedId) return;
    const midiaPendente = mensagens.some(
      (m) => ["image", "video", "audio", "document", "sticker"].includes(m.type) && !m.mediaUrl,
    );
    if (!midiaPendente) {
      midiaRefetchTentativas.current.delete(selectedId);
      return;
    }
    const n = midiaRefetchTentativas.current.get(selectedId) ?? 0;
    if (n >= 20) return;
    const id = window.setTimeout(() => {
      midiaRefetchTentativas.current.set(selectedId, n + 1);
      void sincronizarRecentes();
    }, 3_000);
    return () => window.clearTimeout(id);
  }, [selectedId, mensagens, sincronizarRecentes]);

  const membros = useQuery(
    orpc.organizacao.membros.lista.queryOptions({
      input: orgInput(organizacaoHash),
    }),
  );

  const markRead = useMutation(
    orpc.caixaEntrada.mensagens.marcarLido.mutationOptions({
      onSuccess: () => {
        void conversations.refetch?.();
      },
    }),
  );
  const { mutate: marcarComoLido } = markRead;

  const sendMessage = useMutation(
    orpc.caixaEntrada.mensagens.enviar.mutationOptions({
      onSuccess: (nova) => {
        if (selectedId) {
          anexarMensagem(nova);
          ultimaMensagemEmRef.current = nova.criadoEm;
          setForcarRodapeToken((n) => n + 1);
        }
        void conversations.refetch?.();
      },
    }),
  );

  const fechar = useMutation(
    orpc.caixaEntrada.conversas.fechar.mutationOptions({
      onSuccess: () => {
        void conversations.refetch?.();
        setSelectedId(null);
      },
    }),
  );

  const conversasFiltradas = useMemo(() => {
    let lista = conversations.data;
    if (filtroAtivo === "Não lidas") {
      lista = lista.filter((c: ConversaItem) => c.naoLidas > 0);
    }
    const termo = busca.trim().toLowerCase();
    if (!termo) return lista;
    return lista.filter((c: ConversaItem) => {
      const nome = (c.contatoNome ?? c.contatoTelefone).toLowerCase();
      const preview = formatarPreviewMensagem(
        c.ultimaMensagemPreview,
        c.ultimaMensagemTipo,
      ).toLowerCase();
      const instancia = (c.instanciaNome ?? "").toLowerCase();
      return nome.includes(termo) || preview.includes(termo) || instancia.includes(termo);
    });
  }, [conversations.data, busca, filtroAtivo]);

  const telefoneIniciarBusca = useMemo(() => {
    if (!eCandidatoTelefoneBr(busca)) return null;
    const normalizado = normalizarTelefoneBr(busca);
    const temMatchExato = conversations.data.some((c: ConversaItem) =>
      telefonesBrIguais(c.contatoTelefone, normalizado),
    );
    if (temMatchExato) return null;
    return normalizado;
  }, [busca, conversations.data]);

  const isMetaCloud = isMetaCloudProvider(instance.data?.provider ?? "");
  const cloudWindowOpen = janelaCloudAberta(selected?.metaCloudJanelaExpiraEm);

  const podeEscrever = org.data?.meuPapel === "admin" || org.data?.meuPapel === "usuario";

  const canSend = podeEnviarMensagem({
    papel: org.data?.meuPapel,
    usuarioId: session?.usuario?.id,
    conversaAtribuidaId: selected?.usuarioAtribuidoId,
  });

  const podeIniciarConversa = org.data?.meuPapel === "admin" || org.data?.meuPapel === "usuario";

  const composerDisabled = isMetaCloud && !cloudWindowOpen;

  useEffect(() => {
    setMidia((atual) => {
      if (atual?.previewUrl) URL.revokeObjectURL(atual.previewUrl);
      return null;
    });
    setMessage("");
    setFilaRespostaRapida(null);
  }, [selectedId]);

  useEffect(() => {
    if (!selectedId || mensagens.length === 0) return;
    const ultimaInbound = [...mensagens]
      .toReversed()
      .find((m) => m.direction === "inbound" && m.idExterno);
    if (ultimaInbound?.idExterno) {
      marcarComoLido({
        conversaId: selectedId,
        mensagemIdExterno: ultimaInbound.idExterno,
      });
    }
  }, [selectedId, mensagens, marcarComoLido]);

  async function handleSend() {
    if (!selectedId) return;

    if (filaRespostaRapida && filaRespostaRapida.length > 0) {
      // Sequência deve ir em ordem no WhatsApp — não paralelizar.
      for (const item of filaRespostaRapida) {
        if (item.tipo === "text") {
          // oxlint-disable-next-line eslint/no-await-in-loop -- envio sequencial da fila
          await sendMessage.mutateAsync({
            conversaId: selectedId,
            tipo: "text",
            body: item.corpo,
          });
        } else {
          // oxlint-disable-next-line eslint/no-await-in-loop -- envio sequencial da fila
          await sendMessage.mutateAsync({
            conversaId: selectedId,
            tipo: item.tipo,
            mediaR2Key: item.mediaR2Key!,
            filename: item.nomeArquivo ?? undefined,
            body: item.corpo || undefined,
          });
        }
      }
      setFilaRespostaRapida(null);
      setMessage("");
      setMidia(null);
      return;
    }

    if (midia) {
      await sendMessage.mutateAsync({
        conversaId: selectedId,
        tipo: midia.tipo,
        mediaR2Key: midia.mediaR2Key,
        filename: midia.filename,
        body: message || undefined,
      });
    } else {
      if (!message.trim()) return;
      await sendMessage.mutateAsync({ conversaId: selectedId, tipo: "text", body: message });
    }
    if (midia?.previewUrl) URL.revokeObjectURL(midia.previewUrl);
    setMessage("");
    setMidia(null);
  }

  const listaConversas = conversations.isPending ? (
    <div className="flex justify-center px-4 py-8">
      <Loader2 className="h-5 w-5 animate-spin text-wa-icon" aria-label="Carregando conversas" />
    </div>
  ) : conversasFiltradas.length === 0 ? (
    <p className="px-4 py-8 text-center text-sm text-wa-text-muted">
      {busca.trim()
        ? "Nenhuma conversa encontrada."
        : "Nenhuma conversa ainda. Mensagens recebidas aparecerão aqui."}
    </p>
  ) : (
    conversasFiltradas.map((c: ConversaItem) => (
      <WaChatRow
        key={c.id}
        id={c.contatoId}
        nome={c.contatoNome ?? c.contatoTelefone}
        preview={formatarPreviewMensagem(c.ultimaMensagemPreview, c.ultimaMensagemTipo)}
        time={formatarHorarioConversa(c.ultimaMensagemEm)}
        ativo={selectedId === c.id}
        naoLidas={c.naoLidas}
        etiquetas={c.etiquetas}
        badge={
          <>
            {c.instanciaNome ? (
              <Badge
                variant="outline"
                className="inline-flex max-w-26 items-center gap-1 truncate text-[10px]"
              >
                <IconeConexaoLucide nome={c.instanciaIcone} className="h-3 w-3 shrink-0" />
                <span className="truncate">{c.instanciaNome}</span>
              </Badge>
            ) : null}
            {c.usuarioAtribuidoNome ? (
              <Badge variant="secondary" className="text-[10px]">
                {c.usuarioAtribuidoNome}
              </Badge>
            ) : null}
          </>
        }
        onClick={() => setSelectedId(c.id)}
      />
    ))
  );

  if (!organizacaoHash) return null;

  return (
    <WaShell
      busca={busca}
      onBuscaChange={setBusca}
      filtroAtivo={filtroAtivo}
      onFiltroChange={setFiltroAtivo}
      conversaAberta={Boolean(selected)}
      instancias={instanciasParaNovaConversa}
      instanciaPadraoId={instanciaPadraoNovaConversa}
      organizacaoHash={organizacaoHash}
      podeIniciarConversa={podeIniciarConversa && instanciasParaNovaConversa.length > 0}
      onConversaIniciada={setSelectedId}
      telefoneIniciarBusca={
        podeIniciarConversa && instanciasParaNovaConversa.length > 0 ? telefoneIniciarBusca : null
      }
      iniciarConversaExterna={
        podeIniciarConversa && instanciasParaNovaConversa.length > 0 ? iniciarConversaExterna : null
      }
      onIniciarConversaExternaConsumida={() => {
        setIniciarConversaExterna(null);
        limparSearchInbox();
      }}
      listaConversas={listaConversas}
      chatHeader={
        selected && instanciaAtivaId ? (
          <WaChatHeader
            conversa={selected}
            instanciaId={instanciaAtivaId}
            organizacaoHash={organizacaoHash}
            provedor={instance.data?.provider}
            membros={membros.data ?? []}
            podeAtribuir={podeEscrever}
            podeEtiquetar={podeEscrever}
            onFechar={() => fechar.mutate({ conversaId: selected.id })}
            onVoltarMobile={() => setSelectedId(null)}
          />
        ) : undefined
      }
      chatBody={
        selected ? (
          <WaMessageArea
            conversaId={selected.id}
            mensagens={mensagens}
            temMaisAntigas={temMaisAntigas}
            isFetchingNextPage={isFetchingNextPage}
            onNearTop={() => {
              if (temMaisAntigas && !isFetchingNextPage) {
                void fetchNextPage();
              }
            }}
            forcarRodapeToken={forcarRodapeToken}
          />
        ) : undefined
      }
      composer={
        selected ? (
          composerDisabled ? (
            <p className="border-l border-wa-divider bg-wa-panel-header px-4 py-3 text-sm text-wa-text-muted">
              Fora da janela de 24h — use um template para responder (WhatsApp Cloud API).
            </p>
          ) : (
            <WaComposer
              conversaId={selected.id}
              organizacaoHash={organizacaoHash}
              message={message}
              midia={midia}
              fila={filaRespostaRapida}
              disabled={!canSend}
              pending={sendMessage.isPending}
              podeUsarRespostasRapidas={podeEscrever}
              onChange={setMessage}
              onMidiaChange={setMidia}
              onFilaChange={setFilaRespostaRapida}
              onSend={handleSend}
            />
          )
        ) : undefined
      }
    />
  );
}
