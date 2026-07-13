/**
 * Caixa de entrada estilo WhatsApp Web — lista unificada por organização.
 */
import { skipToken, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { isMetaCloudProvider } from "@whasap/config";
import { Badge } from "@whasap/ui/components/badge";
import { useEffect, useMemo, useState } from "react";

import { WaChatHeader } from "@/components/inbox/wa-chat-header";
import { WaChatRow } from "@/components/inbox/wa-chat-row";
import type { FiltroConversa } from "@/components/inbox/wa-chat-list-panel";
import { WaComposer, type MidiaAnexada } from "@/components/inbox/wa-composer";
import { WaMessageArea } from "@/components/inbox/wa-message-area";
import { WaShell } from "@/components/inbox/wa-shell";
import { useSession } from "@/lib/auth";
import { formatarHorarioConversa, formatarPreviewMensagem } from "@/lib/inbox-utils";
import { IconeConexaoLucide } from "@/lib/icones-conexao";
import { janelaCloudAberta, podeEnviarMensagem } from "@/lib/inbox-permissoes";
import { instanciaOperacional } from "@/lib/instancia-status";
import { orgInput } from "@/lib/org-input";
import { orpc, type ConversaItem } from "@/lib/orpc";
import { useOrganizacaoHash } from "@/lib/use-organizacao-hash";

export const Route = createFileRoute("/_panel/$organizacaoHash/inbox/")({
  component: InboxOrgPage,
});

function InboxOrgPage() {
  const queryClient = useQueryClient();
  const organizacaoHash = useOrganizacaoHash();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [busca, setBusca] = useState("");
  const [filtroAtivo, setFiltroAtivo] = useState<FiltroConversa>("Tudo");
  const [message, setMessage] = useState("");
  const [midia, setMidia] = useState<MidiaAnexada | null>(null);

  const { data: session } = useSession();

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

  const conversations = useQuery({
    ...orpc.caixaEntrada.conversas.lista.queryOptions({
      input: orgInput(organizacaoHash),
    }),
    refetchInterval: 10_000,
    enabled: Boolean(organizacaoHash),
  });

  const selected = conversations.data?.find((c: ConversaItem) => c.id === selectedId);
  const instanciaAtivaId =
    selected?.instanciaId ?? instancias.data?.find((i) => instanciaOperacional(i.status))?.id;

  const instance = useQuery(
    orpc.instancia.obter.queryOptions({
      input: instanciaAtivaId ? { instanciaId: instanciaAtivaId } : skipToken,
    }),
  );

  const messages = useQuery(
    orpc.caixaEntrada.mensagens.lista.queryOptions({
      input: selectedId ? { conversaId: selectedId } : skipToken,
    }),
  );

  const membros = useQuery(
    orpc.organizacao.membros.lista.queryOptions({
      input: orgInput(organizacaoHash),
    }),
  );

  const listaQueryInput = useMemo(
    () => (organizacaoHash ? { organizacaoHash } : null),
    [organizacaoHash],
  );

  const markRead = useMutation(
    orpc.caixaEntrada.mensagens.marcarLido.mutationOptions({
      onSuccess: () => {
        if (!listaQueryInput) return;
        queryClient.invalidateQueries({
          queryKey: orpc.caixaEntrada.conversas.lista.key({ input: listaQueryInput }),
        });
      },
    }),
  );
  const { mutate: marcarComoLido } = markRead;

  const sendMessage = useMutation(
    orpc.caixaEntrada.mensagens.enviar.mutationOptions({
      onSuccess: () => {
        if (selectedId) {
          queryClient.invalidateQueries({
            queryKey: orpc.caixaEntrada.mensagens.lista.key({ input: { conversaId: selectedId } }),
          });
        }
        if (listaQueryInput) {
          queryClient.invalidateQueries({
            queryKey: orpc.caixaEntrada.conversas.lista.key({ input: listaQueryInput }),
          });
        }
      },
    }),
  );

  const fechar = useMutation(
    orpc.caixaEntrada.conversas.fechar.mutationOptions({
      onSuccess: () => {
        if (listaQueryInput) {
          queryClient.invalidateQueries({
            queryKey: orpc.caixaEntrada.conversas.lista.key({ input: listaQueryInput }),
          });
        }
        setSelectedId(null);
      },
    }),
  );

  const conversasFiltradas = useMemo(() => {
    let lista = conversations.data ?? [];
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
  }, [selectedId]);

  useEffect(() => {
    if (!selectedId || !messages.data?.length) return;
    const ultimaInbound = [...messages.data]
      .toReversed()
      .find((m) => m.direction === "inbound" && m.idExterno);
    if (ultimaInbound?.idExterno) {
      marcarComoLido({
        conversaId: selectedId,
        mensagemIdExterno: ultimaInbound.idExterno,
      });
    }
  }, [selectedId, messages.data, marcarComoLido]);

  async function handleSend() {
    if (!selectedId) return;
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

  const listaConversas =
    conversasFiltradas.length === 0 ? (
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
                <Badge variant="outline" className="inline-flex max-w-[6.5rem] items-center gap-1 truncate text-[10px]">
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
      instanciaId={instanciaAtivaId}
      organizacaoHash={organizacaoHash}
      provedor={instance.data?.provider}
      podeIniciarConversa={podeIniciarConversa && Boolean(instanciaAtivaId)}
      onConversaIniciada={setSelectedId}
      listaConversas={listaConversas}
      chatHeader={
        selected && instanciaAtivaId ? (
          <WaChatHeader
            conversa={selected}
            instanciaId={instanciaAtivaId}
            organizacaoHash={organizacaoHash}
            provedor={instance.data?.provider}
            evoHistoricoSincronizandoEm={instance.data?.evoHistoricoSincronizandoEm}
            membros={membros.data ?? []}
            podeAtribuir={podeEscrever}
            podeEtiquetar={podeEscrever}
            onFechar={() => fechar.mutate({ conversaId: selected.id })}
            onVoltarMobile={() => setSelectedId(null)}
          />
        ) : undefined
      }
      chatBody={selected ? <WaMessageArea mensagens={messages.data ?? []} /> : undefined}
      composer={
        selected ? (
          composerDisabled ? (
            <p className="border-l border-wa-divider bg-wa-panel-header px-4 py-3 text-sm text-wa-text-muted">
              Fora da janela de 24h — use um template para responder (WhatsApp Cloud API).
            </p>
          ) : (
            <WaComposer
              conversaId={selected.id}
              message={message}
              midia={midia}
              disabled={!canSend}
              pending={sendMessage.isPending}
              onChange={setMessage}
              onMidiaChange={setMidia}
              onSend={handleSend}
            />
          )
        ) : undefined
      }
    />
  );
}
