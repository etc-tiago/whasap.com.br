/**
 * Caixa de entrada por instância: lista de conversas, mensagens e ações.
 *
 * RBAC (envio): admin em qualquer conversa; usuario só na atribuída;
 * analista somente leitura. Cloud API bloqueia composer fora da janela 24h.
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
import { ScrollArea } from "@whasap/ui/components/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@whasap/ui/components/select";
import { cn } from "@whasap/ui/lib/utils";
import { useEffect, useState } from "react";

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

  return (
    <div className="flex h-[calc(100vh)]">
      <div className="w-80 border-r border-border">
        <div className="border-b border-border p-4">
          <h2 className="font-semibold">Conversas</h2>
        </div>
        <ScrollArea className="h-[calc(100vh-4rem)]">
          {(conversations.data ?? []).map((c: ConversaItem) => (
            <button
              key={c.id}
              type="button"
              onClick={() => setSelectedId(c.id)}
              className={cn(
                "w-full border-b border-border px-4 py-3 text-left hover:bg-accent",
                selectedId === c.id && "bg-accent",
              )}
            >
              <p className="truncate text-sm font-medium">{c.contatoNome ?? c.contatoTelefone}</p>
              {c.usuarioAtribuidoNome && (
                <Badge variant="secondary" className="mt-1 text-[10px]">
                  {c.usuarioAtribuidoNome}
                </Badge>
              )}
              <p className="truncate text-xs text-muted-foreground">{c.ultimaMensagemPreview}</p>
            </button>
          ))}
        </ScrollArea>
      </div>
      <div className="flex flex-1 flex-col">
        {selected ? (
          <>
            <div className="flex items-center justify-between border-b border-border p-4">
              <div>
                <p className="font-medium">{selected.contatoNome ?? selected.contatoTelefone}</p>
                {selected.janelaCloudExpiraEm && (
                  <p className="text-xs text-amber-600">
                    Janela 24h até {new Date(selected.janelaCloudExpiraEm).toLocaleString("pt-BR")}
                  </p>
                )}
              </div>
              <div className="flex gap-2">
                <Dialog open={assignOpen} onOpenChange={setAssignOpen}>
                  <DialogTrigger asChild>
                    <Button size="sm" variant="outline">
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
                  onClick={() => fechar.mutate({ conversaId: selected.id })}
                >
                  Fechar
                </Button>
              </div>
            </div>
            <ScrollArea className="flex-1 p-4">
              <div className="space-y-2">
                {(messages.data ?? []).map((m: MensagemItem) => (
                  <div
                    key={m.id}
                    className={cn(
                      "max-w-[75%] rounded-lg px-3 py-2 text-sm",
                      m.direction === "outbound" ? "ml-auto bg-wa-green text-white" : "bg-muted",
                    )}
                  >
                    <p>{m.body}</p>
                    {m.enviadoPorNome && m.direction === "outbound" && (
                      <p className="mt-1 text-[10px] opacity-80">{m.enviadoPorNome}</p>
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
                      <p className="mt-1 text-[10px] opacity-80">Template: {m.templateNome}</p>
                    )}
                  </div>
                ))}
              </div>
            </ScrollArea>
            <div className="flex gap-2 border-t border-border p-4">
              {composerDisabled ? (
                <p className="flex-1 text-sm text-muted-foreground">
                  Fora da janela de 24h — use um template para responder (Cloud API).
                </p>
              ) : (
                <div className="flex flex-1 flex-col gap-2 sm:flex-row sm:items-end">
                  <Select
                    value={tipoMensagem}
                    onValueChange={(v) =>
                      setTipoMensagem(v as "text" | "image" | "audio" | "video" | "document")
                    }
                  >
                    <SelectTrigger className="w-full sm:w-36">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="text">Texto</SelectItem>
                      <SelectItem value="image">Imagem</SelectItem>
                      <SelectItem value="audio">Áudio</SelectItem>
                      <SelectItem value="video">Vídeo</SelectItem>
                      <SelectItem value="document">Documento</SelectItem>
                    </SelectContent>
                  </Select>
                  {tipoMensagem !== "text" && (
                    <Input
                      value={mediaUrl}
                      onChange={(e) => setMediaUrl(e.target.value)}
                      placeholder="URL da mídia (HTTPS)"
                      disabled={!canSend || sendMessage.isPending}
                      className="flex-1"
                    />
                  )}
                  <Input
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder={
                      tipoMensagem === "text"
                        ? canSend
                          ? "Digite uma mensagem..."
                          : "Sem permissão para enviar"
                        : "Legenda (opcional)"
                    }
                    disabled={!canSend || sendMessage.isPending}
                    onKeyDown={(e) => e.key === "Enter" && handleSend()}
                    className="flex-1"
                  />
                  <Button
                    onClick={handleSend}
                    disabled={
                      !canSend ||
                      sendMessage.isPending ||
                      (tipoMensagem === "text" ? !message.trim() : !mediaUrl.trim())
                    }
                  >
                    Enviar
                  </Button>
                </div>
              )}
            </div>
          </>
        ) : (
          <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
            Selecione uma conversa
          </div>
        )}
      </div>
    </div>
  );
}
