/**
 * Caixa de entrada estilo WhatsApp Web por instância.
 */
import { skipToken, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Badge } from "@whasap/ui/components/badge";
import { useEffect, useMemo, useState } from "react";

import { WaChatHeader } from "@/components/inbox/wa-chat-header";
import { WaChatRow } from "@/components/inbox/wa-chat-row";
import { WaComposer, type MidiaAnexada } from "@/components/inbox/wa-composer";
import { WaMessageArea } from "@/components/inbox/wa-message-area";
import { WaShell } from "@/components/inbox/wa-shell";
import { useSession } from "@/lib/auth";
import { formatarHorarioConversa } from "@/lib/inbox-utils";
import { janelaCloudAberta, podeEnviarMensagem } from "@/lib/inbox-permissoes";
import { orgInput } from "@/lib/org-input";
import { orpc, type ConversaItem } from "@/lib/orpc";
import { useOrganizacaoHash } from "@/lib/use-organizacao-hash";

export const Route = createFileRoute("/_panel/$organizacaoHash/inbox/$instanceId/")({
  component: InboxPage,
});

function InboxPage() {
  const { instanceId } = Route.useParams();
  const queryClient = useQueryClient();
  const organizacaoHash = useOrganizacaoHash();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [busca, setBusca] = useState("");
  const [message, setMessage] = useState("");
  const [midia, setMidia] = useState<MidiaAnexada | null>(null);

  const { data: session } = useSession();

  const org = useQuery(
    orpc.organizacao.obter.queryOptions({
      input: orgInput(organizacaoHash),
    }),
  );

  const instance = useQuery(
    orpc.instancia.obter.queryOptions({ input: { instanciaId: instanceId } }),
  );

  const conversations = useQuery(
    orpc.caixaEntrada.conversas.lista.queryOptions({
      input: { instanciaId: instanceId },
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

  const markRead = useMutation(orpc.caixaEntrada.mensagens.marcarLido.mutationOptions());
  const { mutate: marcarComoLido } = markRead;

  const sendMessage = useMutation(
    orpc.caixaEntrada.mensagens.enviar.mutationOptions({
      onSuccess: () => {
        if (selectedId) {
          queryClient.invalidateQueries({
            queryKey: orpc.caixaEntrada.mensagens.lista.key({ input: { conversaId: selectedId } }),
          });
          queryClient.invalidateQueries({
            queryKey: orpc.caixaEntrada.conversas.lista.key({ input: { instanciaId: instanceId } }),
          });
        }
      },
    }),
  );

  const fechar = useMutation(
    orpc.caixaEntrada.conversas.fechar.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries({
          queryKey: orpc.caixaEntrada.conversas.lista.key({ input: { instanciaId: instanceId } }),
        });
        setSelectedId(null);
      },
    }),
  );

  const selected = conversations.data?.find((c: ConversaItem) => c.id === selectedId);
  const conversasFiltradas = useMemo(() => {
    const lista = conversations.data ?? [];
    const termo = busca.trim().toLowerCase();
    if (!termo) return lista;
    return lista.filter((c: ConversaItem) => {
      const nome = (c.contatoNome ?? c.contatoTelefone).toLowerCase();
      const preview = (c.ultimaMensagemPreview ?? "").toLowerCase();
      return nome.includes(termo) || preview.includes(termo);
    });
  }, [conversations.data, busca]);

  const isCloud = instance.data?.provider === "cloud_api";
  const cloudWindowOpen = janelaCloudAberta(selected?.janelaCloudExpiraEm);

  const podeEscrever =
    org.data?.meuPapel === "admin" || org.data?.meuPapel === "usuario";

  const canSend = podeEnviarMensagem({
    papel: org.data?.meuPapel,
    usuarioId: session?.usuario?.id,
    conversaAtribuidaId: selected?.usuarioAtribuidoId,
  });

  const podeIniciarConversa =
    org.data?.meuPapel === "admin" || org.data?.meuPapel === "usuario";

  const composerDisabled = isCloud && !cloudWindowOpen;

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
          preview={c.ultimaMensagemPreview}
          time={formatarHorarioConversa(c.ultimaMensagemEm)}
          ativo={selectedId === c.id}
          badge={
            c.usuarioAtribuidoNome ? (
              <Badge variant="secondary" className="text-[10px]">
                {c.usuarioAtribuidoNome}
              </Badge>
            ) : undefined
          }
          onClick={() => setSelectedId(c.id)}
        />
      ))
    );

  return (
    <WaShell
      busca={busca}
      onBuscaChange={setBusca}
      conversaAberta={Boolean(selected)}
      instanciaId={instanceId}
      provedor={instance.data?.provider}
      podeIniciarConversa={podeIniciarConversa}
      onConversaIniciada={setSelectedId}
      listaConversas={listaConversas}
      chatHeader={
        selected ? (
          <WaChatHeader
            conversa={selected}
            instanciaId={instanceId}
            organizacaoHash={organizacaoHash ?? ""}
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
              Fora da janela de 24h — use um template para responder (Cloud API).
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
