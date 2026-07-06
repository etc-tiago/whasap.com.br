import { createFileRoute } from "@tanstack/react-router";
import { skipToken, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
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
import { Label } from "@whasap/ui/components/label";
import { ScrollArea } from "@whasap/ui/components/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@whasap/ui/components/select";
import { cn } from "@whasap/ui/lib/utils";

import { useSession } from "@/lib/auth";
import { orpc, type ConversaItem, type MensagemItem } from "@/lib/orpc";

export const Route = createFileRoute("/_panel/inbox/$instanceId")({
  component: InboxPage,
});

function InboxPage() {
  const { instanceId } = Route.useParams();
  const queryClient = useQueryClient();
  const { data: session } = useSession();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [assignOpen, setAssignOpen] = useState(false);
  const [assignUserId, setAssignUserId] = useState<string>("");

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
      input: session?.organizacao?.id
        ? { organizacaoId: session.organizacao.id }
        : skipToken,
    }),
  );

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
  const cloudWindowOpen =
    selected?.janelaCloudExpiraEm && new Date(selected.janelaCloudExpiraEm) > new Date();

  const canSend =
    session?.role === "admin" ||
    (session?.role === "usuario" &&
      (!selected?.usuarioAtribuidoId || selected.usuarioAtribuidoId === session.usuario?.id));

  const composerDisabled = isCloud && !cloudWindowOpen;

  async function handleSend() {
    if (!selectedId || !message.trim()) return;
    await sendMessage.mutateAsync({ conversaId: selectedId, body: message, tipo: "text" });
    setMessage("");
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
                <Button size="sm" variant="ghost" onClick={() => fechar.mutate({ conversaId: selected.id })}>
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
                <>
                  <Input
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder={canSend ? "Digite uma mensagem..." : "Sem permissão para enviar"}
                    disabled={!canSend || sendMessage.isPending}
                    onKeyDown={(e) => e.key === "Enter" && handleSend()}
                  />
                  <Button
                    onClick={handleSend}
                    disabled={!canSend || !message.trim() || sendMessage.isPending}
                  >
                    Enviar
                  </Button>
                </>
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
