/**
 * Caixa de entrada estilo WhatsApp Web por instância.
 */
import { skipToken, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Badge } from "@whasap/ui/components/badge";
import { Button } from "@whasap/ui/components/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@whasap/ui/components/dialog";
import { Input } from "@whasap/ui/components/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@whasap/ui/components/select";
import { useEffect, useState } from "react";

import {
  InboxWaBolha,
  InboxWaComposer,
  InboxWaConversaItem,
  InboxWaShell,
} from "@/components/inbox/inbox-wa-shell";
import { useSession } from "@/lib/auth";
import { janelaCloudAberta, podeEnviarMensagem } from "@/lib/inbox-permissoes";
import { orgInput } from "@/lib/org-input";
import { orpc, type ConversaItem, type MensagemItem } from "@/lib/orpc";
import { useOrganizacaoHash } from "@/lib/use-organizacao-hash";

export const Route = createFileRoute("/_panel/$organizacaoHash/inbox/$instanceId")({
  component: InboxPage,
});

function InboxPage() {
  const { instanceId } = Route.useParams();
  const queryClient = useQueryClient();
  const organizacaoHash = useOrganizacaoHash();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [tipoMensagem, setTipoMensagem] = useState<
    "text" | "image" | "audio" | "video" | "document"
  >("text");
  const [mediaUrl, setMediaUrl] = useState("");
  const [assignOpen, setAssignOpen] = useState(false);
  const [assignUserId, setAssignUserId] = useState<string>("");

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

  const atribuir = useMutation(
    orpc.caixaEntrada.conversas.atribuir.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries({
          queryKey: orpc.caixaEntrada.conversas.lista.key({ input: { instanciaId: instanceId } }),
        });
        setAssignOpen(false);
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
  const isCloud = instance.data?.provider === "cloud_api";
  const cloudWindowOpen = janelaCloudAberta(selected?.janelaCloudExpiraEm);

  const canSend = podeEnviarMensagem({
    papel: org.data?.meuPapel,
    usuarioId: session?.usuario?.id,
    conversaAtribuidaId: selected?.usuarioAtribuidoId,
  });

  const composerDisabled = isCloud && !cloudWindowOpen;

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
    if (tipoMensagem === "text") {
      if (!message.trim()) return;
      await sendMessage.mutateAsync({ conversaId: selectedId, tipo: "text", body: message });
    } else {
      if (!mediaUrl.trim()) return;
      await sendMessage.mutateAsync({
        conversaId: selectedId,
        tipo: tipoMensagem,
        mediaUrl,
        body: message || undefined,
      });
    }
    setMessage("");
    setMediaUrl("");
  }

  const composerExtra =
    tipoMensagem !== "text" ? (
      <Input
        value={mediaUrl}
        onChange={(e) => setMediaUrl(e.target.value)}
        placeholder="URL da mídia"
        disabled={!canSend || sendMessage.isPending}
        className="max-w-40"
      />
    ) : (
      <Select
        value={tipoMensagem}
        onValueChange={(v) => setTipoMensagem(v as typeof tipoMensagem)}
      >
        <SelectTrigger className="h-9 w-24 border-0 bg-transparent shadow-none">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="text">Texto</SelectItem>
          <SelectItem value="image">Imagem</SelectItem>
          <SelectItem value="audio">Áudio</SelectItem>
          <SelectItem value="video">Vídeo</SelectItem>
          <SelectItem value="document">Doc</SelectItem>
        </SelectContent>
      </Select>
    );

  return (
    <InboxWaShell
      organizacaoHash={organizacaoHash ?? ""}
      instanceNome={instance.data?.nome ?? "WhatsApp"}
      selectedId={selectedId}
      conversas={
        (conversations.data ?? []).length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-wa-text-muted">
            Nenhuma conversa ainda. Mensagens recebidas aparecerão aqui.
          </p>
        ) : (
          (conversations.data ?? []).map((c: ConversaItem) => (
            <InboxWaConversaItem
              key={c.id}
              nome={c.contatoNome ?? c.contatoTelefone}
              preview={c.ultimaMensagemPreview}
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
        )
      }
      chatHeader={
        selected ? (
          <>
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white/20 text-sm font-semibold">
              {(selected.contatoNome ?? selected.contatoTelefone).slice(0, 1).toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium">{selected.contatoNome ?? selected.contatoTelefone}</p>
              {selected.janelaCloudExpiraEm && (
                <p className="truncate text-xs text-white/80">
                  Janela 24h até {new Date(selected.janelaCloudExpiraEm).toLocaleString("pt-BR")}
                </p>
              )}
            </div>
            <Dialog open={assignOpen} onOpenChange={setAssignOpen}>
              <DialogTrigger asChild>
                <Button size="sm" variant="secondary" className="bg-white/15 text-white hover:bg-white/25">
                  Atribuir
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Atribuir conversa</DialogTitle>
                </DialogHeader>
                <div className="space-y-3">
                  <Select value={assignUserId} onValueChange={setAssignUserId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione um agente" />
                    </SelectTrigger>
                    <SelectContent>
                      {(membros.data ?? []).map((m) => (
                        <SelectItem key={m.id} value={m.usuarioId}>
                          {m.usuarioNome ?? m.usuarioId.slice(0, 8)} ({m.role})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button
                    onClick={() =>
                      atribuir.mutate({
                        conversaId: selected.id,
                        usuarioId: assignUserId || null,
                      })
                    }
                  >
                    Salvar
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
            <Button
              size="sm"
              variant="ghost"
              className="text-white hover:bg-white/15"
              onClick={() => fechar.mutate({ conversaId: selected.id })}
            >
              Fechar
            </Button>
          </>
        ) : null
      }
      chatBody={
        <div className="flex flex-col gap-2">
          {(messages.data ?? []).map((m: MensagemItem) => (
            <InboxWaBolha key={m.id} outbound={m.direction === "outbound"}>
              <p className="whitespace-pre-wrap break-words">{m.body}</p>
              {m.enviadoPorNome && m.direction === "outbound" && (
                <p className="mt-1 text-[10px] opacity-70">{m.enviadoPorNome}</p>
              )}
              {m.mediaUrl && (
                <a
                  href={m.mediaUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-1 block text-xs underline"
                >
                  Ver mídia
                </a>
              )}
              {m.templateNome && (
                <p className="mt-1 text-[10px] opacity-70">Template: {m.templateNome}</p>
              )}
            </InboxWaBolha>
          ))}
        </div>
      }
      composer={
        composerDisabled ? (
          <p className="px-2 py-2 text-sm text-wa-text-muted">
            Fora da janela de 24h — use um template para responder (Cloud API).
          </p>
        ) : (
          <InboxWaComposer
            message={message}
            disabled={!canSend}
            pending={sendMessage.isPending}
            onChange={setMessage}
            onSend={handleSend}
            extra={composerExtra}
          />
        )
      }
    />
  );
}
