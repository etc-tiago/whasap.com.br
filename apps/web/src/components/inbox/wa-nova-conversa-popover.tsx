import { skipToken, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
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
import { useEffect, useMemo, useRef, useState } from "react";

import { WaIconButton } from "@/components/inbox/wa-icon-button";
import { IconeConexaoLucide } from "@/lib/icones-conexao";
import { orpc } from "@/lib/orpc";
import { getOrpcErrorMessage } from "@/lib/orpc-error";
import { extrairIndicesVariaveisTemplate, textoCorpoTemplate } from "@/lib/template-variaveis";

export type InstanciaNovaConversa = {
  id: string;
  nome: string;
  icone: string;
  provider: string;
};

type WaNovaConversaPopoverProps = {
  organizacaoHash: string;
  instancias: InstanciaNovaConversa[];
  /** Instância pré-selecionada ao abrir (ex.: da conversa ativa). */
  instanciaPadraoId?: string;
  disabled?: boolean;
  onConversaIniciada: (conversaId: string) => void;
  /** Controle externo do popover (compartilhado com o chip da busca). */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  /** Prefill ao abrir (ex.: telefone digitado na busca). */
  telefoneInicial?: string;
};

export function WaNovaConversaPopover({
  organizacaoHash,
  instancias,
  instanciaPadraoId,
  disabled,
  onConversaIniciada,
  open: openControlado,
  onOpenChange: onOpenChangeControlado,
  telefoneInicial,
}: WaNovaConversaPopoverProps) {
  const queryClient = useQueryClient();
  const [openInterno, setOpenInterno] = useState(false);
  const open = openControlado ?? openInterno;
  const setOpen = onOpenChangeControlado ?? setOpenInterno;
  const [instanciaId, setInstanciaId] = useState("");
  const [telefone, setTelefone] = useState("");
  const [nome, setNome] = useState("");
  const [corpo, setCorpo] = useState("");
  const [templateId, setTemplateId] = useState("");
  const [variaveis, setVariaveis] = useState<Record<string, string>>({});
  const estavaAberto = useRef(false);

  const instanciaSelecionada =
    instancias.find((i) => i.id === instanciaId) ?? instancias[0] ?? null;
  const provedor = instanciaSelecionada?.provider ?? "";
  const isMetaCloud = isMetaCloudProvider(provedor);
  const isEvo = isEvoProvider(provedor);
  const mostrarSeletorInstancia = instancias.length > 1;

  useEffect(() => {
    const acabouDeAbrir = open && !estavaAberto.current;
    estavaAberto.current = open;
    if (!open) return;

    if (acabouDeAbrir) {
      const padrao =
        (instanciaPadraoId && instancias.some((i) => i.id === instanciaPadraoId)
          ? instanciaPadraoId
          : null) ??
        instancias[0]?.id ??
        "";
      setInstanciaId(padrao);
      if (telefoneInicial) {
        setTelefone(telefoneInicial);
      }
      return;
    }

    setInstanciaId((atual) =>
      atual && instancias.some((i) => i.id === atual) ? atual : (instancias[0]?.id ?? ""),
    );
  }, [open, telefoneInicial, instanciaPadraoId, instancias]);

  const templates = useQuery(
    orpc.caixaEntrada.templates.lista.queryOptions({
      input: open && isMetaCloud && instanciaId ? { instanciaId } : skipToken,
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

  function trocarInstancia(proximaId: string) {
    if (proximaId === instanciaId) return;
    const anterior = instancias.find((i) => i.id === instanciaId);
    const proxima = instancias.find((i) => i.id === proximaId);
    setInstanciaId(proximaId);
    if (anterior?.provider !== proxima?.provider) {
      setCorpo("");
      setTemplateId("");
      setVariaveis({});
    } else if (isMetaCloudProvider(proxima?.provider ?? "")) {
      setTemplateId("");
      setVariaveis({});
    }
  }

  function podeEnviar(): boolean {
    if (!instanciaId) return false;
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
    if (!podeEnviar() || iniciar.isPending || !instanciaId) return;

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
          {mostrarSeletorInstancia ? (
            <div className="space-y-1.5">
              <Label>Enviar de</Label>
              <Select
                value={instanciaId}
                onValueChange={trocarInstancia}
                disabled={iniciar.isPending}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o número" />
                </SelectTrigger>
                <SelectContent>
                  {instancias.map((inst) => (
                    <SelectItem key={inst.id} value={inst.id}>
                      <span className="inline-flex items-center gap-2">
                        <IconeConexaoLucide nome={inst.icone} className="h-3.5 w-3.5 shrink-0" />
                        <span className="truncate">{inst.nome}</span>
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : null}

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
