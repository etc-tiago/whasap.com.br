import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { isEvoProvider, isMetaCloudProvider } from "@whasap/config";
import { Button } from "@whasap/ui/components/button";
import { Input } from "@whasap/ui/components/input";
import { Label } from "@whasap/ui/components/label";
import { Popover, PopoverContent, PopoverTrigger } from "@whasap/ui/components/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@whasap/ui/components/select";
import { Textarea } from "@whasap/ui/components/textarea";
import { MessageSquarePlus } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { WaIconButton } from "@/components/inbox/wa-icon-button";
import { orpc } from "@/lib/orpc";
import { getOrpcErrorMessage } from "@/lib/orpc-error";
import { extrairIndicesVariaveisTemplate, textoCorpoTemplate } from "@/lib/template-variaveis";

type WaNovaConversaPopoverProps = {
  organizacaoHash: string;
  instanciaId: string;
  provedor: string;
  disabled?: boolean;
  onConversaIniciada: (conversaId: string) => void;
};

export function WaNovaConversaPopover({
  organizacaoHash,
  instanciaId,
  provedor,
  disabled,
  onConversaIniciada,
}: WaNovaConversaPopoverProps) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [telefone, setTelefone] = useState("");
  const [nome, setNome] = useState("");
  const [corpo, setCorpo] = useState("");
  const [templateId, setTemplateId] = useState("");
  const [variaveis, setVariaveis] = useState<Record<string, string>>({});

  const isMetaCloud = isMetaCloudProvider(provedor);
  const isEvo = isEvoProvider(provedor);

  const templates = useQuery(
    orpc.caixaEntrada.templates.lista.queryOptions({
      input: { instanciaId },
      enabled: open && isMetaCloud,
    }),
  );

  const templatesAprovados = useMemo(
    () => (templates.data ?? []).filter((t) => t.status === "APPROVED"),
    [templates.data],
  );

  const templateSelecionado = templatesAprovados.find((t) => t.id === templateId);
  const indicesVariaveis = useMemo(
    () => extrairIndicesVariaveisTemplate(templateSelecionado?.componentes),
    [templateSelecionado?.componentes],
  );
  const previewCorpo = textoCorpoTemplate(templateSelecionado?.componentes);

  useEffect(() => {
    if (!templateId || !templateSelecionado) {
      setVariaveis({});
      return;
    }
    const indices = extrairIndicesVariaveisTemplate(templateSelecionado.componentes);
    setVariaveis(Object.fromEntries(indices.map((indice) => [indice, ""])));
  }, [templateId, templateSelecionado]);

  const iniciar = useMutation(
    orpc.caixaEntrada.conversas.iniciar.mutationOptions({
      onSuccess: (data) => {
        queryClient.invalidateQueries({
          queryKey: orpc.caixaEntrada.conversas.lista.key({
            input: { organizacaoHash },
          }),
        });
        setOpen(false);
        resetForm();
        onConversaIniciada(data.conversaId);
      },
    }),
  );

  function resetForm() {
    setTelefone("");
    setNome("");
    setCorpo("");
    setTemplateId("");
    setVariaveis({});
  }

  function podeEnviar(): boolean {
    if (telefone.replace(/\D/g, "").length < 8) return false;
    if (isEvo) return corpo.trim().length > 0;
    if (isMetaCloud) {
      if (!templateId) return false;
      return indicesVariaveis.every((indice) => variaveis[indice]?.trim());
    }
    return false;
  }

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!podeEnviar() || iniciar.isPending) return;

    iniciar.mutate({
      instanciaId,
      telefone,
      nome: nome.trim() || undefined,
      corpo: isEvo ? corpo.trim() : undefined,
      templateId: isMetaCloud ? templateId : undefined,
      variaveis:
        isMetaCloud && indicesVariaveis.length > 0
          ? Object.fromEntries(
              indicesVariaveis.map((indice) => [indice, variaveis[indice]?.trim() ?? ""]),
            )
          : undefined,
    });
  }

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) resetForm();
      }}
    >
      <PopoverTrigger asChild>
        <WaIconButton disabled={disabled} label="Nova conversa">
          <MessageSquarePlus className="h-5 w-5" />
        </WaIconButton>
      </PopoverTrigger>
      <PopoverContent className="w-80 space-y-3" align="start" side="bottom">
        <p className="text-sm font-medium text-wa-text">Nova conversa</p>

        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="nova-conversa-telefone">Telefone</Label>
            <Input
              id="nova-conversa-telefone"
              value={telefone}
              onChange={(e) => setTelefone(e.target.value)}
              placeholder="5511999999999"
              disabled={iniciar.isPending}
              autoComplete="tel"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="nova-conversa-nome">Nome (opcional)</Label>
            <Input
              id="nova-conversa-nome"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              placeholder="Nome do contato"
              disabled={iniciar.isPending}
            />
          </div>

          {isEvo ? (
            <div className="space-y-1.5">
              <Label htmlFor="nova-conversa-mensagem">Mensagem inicial</Label>
              <Textarea
                id="nova-conversa-mensagem"
                value={corpo}
                onChange={(e) => setCorpo(e.target.value)}
                placeholder="Olá! Como posso ajudar?"
                rows={3}
                disabled={iniciar.isPending}
              />
            </div>
          ) : null}

          {isMetaCloud ? (
            <>
              <div className="space-y-1.5">
                <Label>Modelo</Label>
                {templates.isLoading ? (
                  <p className="text-xs text-muted-foreground">Carregando modelos...</p>
                ) : templatesAprovados.length === 0 ? (
                  <p className="text-xs text-muted-foreground">
                    Nenhum modelo aprovado. Sincronize os modelos na integração Cloud API.
                  </p>
                ) : (
                  <Select
                    value={templateId}
                    onValueChange={setTemplateId}
                    disabled={iniciar.isPending}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione um modelo" />
                    </SelectTrigger>
                    <SelectContent>
                      {templatesAprovados.map((tpl) => (
                        <SelectItem key={tpl.id} value={tpl.id}>
                          {tpl.nome} ({tpl.idioma})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>

              {previewCorpo ? (
                <p className="rounded-md bg-muted px-2 py-1.5 text-xs text-muted-foreground">
                  {previewCorpo}
                </p>
              ) : null}

              {indicesVariaveis.map((indice) => (
                <div key={indice} className="space-y-1.5">
                  <Label htmlFor={`nova-conversa-var-${indice}`}>Variável {indice}</Label>
                  <Input
                    id={`nova-conversa-var-${indice}`}
                    value={variaveis[indice] ?? ""}
                    onChange={(e) =>
                      setVariaveis((atual) => ({ ...atual, [indice]: e.target.value }))
                    }
                    disabled={iniciar.isPending}
                  />
                </div>
              ))}
            </>
          ) : null}

          {!isEvo && !isMetaCloud ? (
            <p className="text-xs text-muted-foreground">
              Provedor não suportado para iniciar conversa pelo painel.
            </p>
          ) : null}

          {iniciar.isError ? (
            <p className="text-xs text-destructive">
              {getOrpcErrorMessage(iniciar.error, "Não foi possível iniciar a conversa.")}
            </p>
          ) : null}

          <Button
            type="submit"
            className="w-full"
            disabled={!podeEnviar() || iniciar.isPending || (!isEvo && !isMetaCloud)}
          >
            {iniciar.isPending ? "Iniciando..." : "Iniciar conversa"}
          </Button>
        </form>
      </PopoverContent>
    </Popover>
  );
}
