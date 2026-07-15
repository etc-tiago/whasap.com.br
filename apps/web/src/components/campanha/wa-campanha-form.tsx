import { skipToken, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { isEvoProvider, isMetaCloudProvider, rotuloProvedor } from "@whasap/config";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@whasap/ui/components/alert-dialog";
import { Button } from "@whasap/ui/components/button";
import { Checkbox } from "@whasap/ui/components/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@whasap/ui/components/dialog";
import { Input } from "@whasap/ui/components/input";
import { Label } from "@whasap/ui/components/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@whasap/ui/components/select";
import { Textarea } from "@whasap/ui/components/textarea";
import { ExternalLink } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { CAMPANHA_ARTIGO_URL } from "@/lib/campanha";
import { IconeConexaoLucide } from "@/lib/icones-conexao";
import { orpc } from "@/lib/orpc";
import { getOrpcErrorMessage } from "@/lib/orpc-error";
import { extrairIndicesVariaveisTemplate, textoCorpoTemplate } from "@/lib/template-variaveis";

export type InstanciaCampanha = {
  id: string;
  nome: string;
  icone: string;
  provider: string;
};

type WaCampanhaFormProps = {
  organizacaoHash: string;
  instancias: InstanciaCampanha[];
  instanciaPadraoId?: string;
  nomeInicial?: string;
  telefoneInicial?: string;
  alertaConsecutivos?: number;
  compacto?: boolean;
  onEnviado?: (conversaId: string) => void;
};

/**
 * Formulário de envio imediato de campanha (nome, telefone, texto/template).
 * Cloud API: modal de variáveis + opção de memorizar template.
 */
export function WaCampanhaForm({
  organizacaoHash,
  instancias,
  instanciaPadraoId,
  nomeInicial,
  telefoneInicial,
  alertaConsecutivos = 5,
  compacto,
  onEnviado,
}: WaCampanhaFormProps) {
  const queryClient = useQueryClient();
  const [instanciaId, setInstanciaId] = useState("");
  const [nome, setNome] = useState("");
  const [telefone, setTelefone] = useState("");
  const [corpo, setCorpo] = useState("");
  const [templateId, setTemplateId] = useState("");
  const [variaveis, setVariaveis] = useState<Record<string, string>>({});
  const [modalVariaveisAberto, setModalVariaveisAberto] = useState(false);
  const [memorizar, setMemorizar] = useState(false);
  const [nomeMemoria, setNomeMemoria] = useState("");
  const [alertaAberto, setAlertaAberto] = useState(false);
  const [enviosRecentes, setEnviosRecentes] = useState(0);
  const [erro, setErro] = useState<string | null>(null);

  const instanciaSelecionada =
    instancias.find((i) => i.id === instanciaId) ?? instancias[0] ?? null;
  const provedor = instanciaSelecionada?.provider ?? "";
  const isMetaCloud = isMetaCloudProvider(provedor);
  const isEvo = isEvoProvider(provedor);
  const orgTemEvo = instancias.some((i) => isEvoProvider(i.provider));

  useEffect(() => {
    const padrao =
      (instanciaPadraoId && instancias.some((i) => i.id === instanciaPadraoId)
        ? instanciaPadraoId
        : null) ??
      instancias[0]?.id ??
      "";
    setInstanciaId(padrao);
  }, [instanciaPadraoId, instancias]);

  useEffect(() => {
    if (nomeInicial !== undefined) setNome(nomeInicial);
  }, [nomeInicial]);

  useEffect(() => {
    if (telefoneInicial !== undefined) setTelefone(telefoneInicial);
  }, [telefoneInicial]);

  const templates = useQuery(
    orpc.caixaEntrada.templates.lista.queryOptions({
      input: isMetaCloud && instanciaId ? { instanciaId } : skipToken,
    }),
  );

  const memorizados = useQuery(
    orpc.campanha.templatesMemorizados.lista.queryOptions({
      input:
        isMetaCloud && organizacaoHash
          ? { organizacaoHash, instanciaId: instanciaId || undefined }
          : skipToken,
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
    setVariaveis((prev) => {
      const next: Record<string, string> = {};
      for (const indice of indices) next[indice] = prev[indice] ?? "";
      return next;
    });
  }, [templateId, templateSelecionado]);

  const enviar = useMutation(
    orpc.campanha.enviar.mutationOptions({
      onSuccess: async (data) => {
        setErro(null);
        setEnviosRecentes(data.contagemRecente);
        if (data.alertaVolume) {
          // próxima tentativa pedirá confirmação via contagem local
        }
        await Promise.all([
          queryClient.invalidateQueries({
            queryKey: orpc.campanha.listaEnvios.key(),
          }),
          queryClient.invalidateQueries({
            queryKey: orpc.campanha.resumo.key(),
          }),
          queryClient.invalidateQueries({
            queryKey: orpc.campanha.templatesMemorizados.lista.key(),
          }),
          queryClient.invalidateQueries({
            queryKey: orpc.caixaEntrada.conversas.lista.key({
              input: { organizacaoHash },
            }),
          }),
        ]);
        setModalVariaveisAberto(false);
        setCorpo("");
        setTemplateId("");
        setVariaveis({});
        setMemorizar(false);
        setNomeMemoria("");
        onEnviado?.(data.conversaId);
      },
      onError: (e) => {
        setErro(getOrpcErrorMessage(e, "Não foi possível enviar."));
      },
    }),
  );

  function podeEnviar(): boolean {
    if (!instanciaId) return false;
    if (!nome.trim()) return false;
    if (telefone.replace(/\D/g, "").length < 8) return false;
    if (isEvo) return corpo.trim().length > 0;
    if (isMetaCloud) return Boolean(templateId);
    return false;
  }

  function disparar(confirmarAlertaVolume: boolean) {
    if (!podeEnviar() || enviar.isPending || !instanciaId) return;

    enviar.mutate({
      organizacaoHash,
      instanciaId,
      nome: nome.trim(),
      telefone,
      corpo: isEvo ? corpo.trim() : undefined,
      templateId: isMetaCloud ? templateId : undefined,
      variaveis:
        isMetaCloud && indicesVariaveis.length > 0
          ? Object.fromEntries(
              indicesVariaveis.map((indice) => [indice, variaveis[indice]?.trim() ?? ""]),
            )
          : undefined,
      confirmarAlertaVolume,
      memorizarTemplate:
        isMetaCloud && memorizar && nomeMemoria.trim() ? { nome: nomeMemoria.trim() } : undefined,
    });
  }

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!podeEnviar() || enviar.isPending) return;

    if (isMetaCloud && indicesVariaveis.length > 0 && !modalVariaveisAberto) {
      setModalVariaveisAberto(true);
      return;
    }

    if (enviosRecentes + 1 >= alertaConsecutivos) {
      setAlertaAberto(true);
      return;
    }

    disparar(false);
  }

  function aplicarMemorizado(id: string) {
    const item = (memorizados.data ?? []).find((m) => m.id === id);
    if (!item) return;
    const tpl = templatesAprovados.find(
      (t) => t.nome === item.templateNome && t.idioma === item.templateIdioma,
    );
    if (tpl) setTemplateId(tpl.id);
    if (item.variaveis) setVariaveis(item.variaveis);
    setNomeMemoria(item.nome);
  }

  return (
    <div className={compacto ? "space-y-3" : "space-y-4"}>
      {orgTemEvo ? (
        <p className="text-xs leading-snug text-amber-800 dark:text-amber-200">
          Envio em massa no {rotuloProvedor("evo")} pode resultar em bloqueio do número.{" "}
          <a
            href={CAMPANHA_ARTIGO_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-0.5 font-medium underline underline-offset-2"
          >
            Boas práticas
            <ExternalLink className="h-3 w-3" />
          </a>
        </p>
      ) : null}

      <form onSubmit={handleSubmit} className="space-y-3">
        {instancias.length > 1 ? (
          <div className="space-y-1.5">
            <Label>Enviar de</Label>
            <Select
              value={instanciaId}
              onValueChange={(id) => {
                setInstanciaId(id);
                setCorpo("");
                setTemplateId("");
                setVariaveis({});
              }}
              disabled={enviar.isPending}
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
          <Label htmlFor="campanha-nome">Nome</Label>
          <Input
            id="campanha-nome"
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            placeholder="Nome da pessoa"
            disabled={enviar.isPending}
            required
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="campanha-telefone">Telefone</Label>
          <Input
            id="campanha-telefone"
            value={telefone}
            onChange={(e) => setTelefone(e.target.value)}
            placeholder="5511999999999"
            disabled={enviar.isPending}
            autoComplete="tel"
            required
          />
        </div>

        {isEvo ? (
          <div className="space-y-1.5">
            <Label htmlFor="campanha-texto">Texto</Label>
            <Textarea
              id="campanha-texto"
              value={corpo}
              onChange={(e) => setCorpo(e.target.value)}
              placeholder="Mensagem a enviar"
              rows={compacto ? 3 : 4}
              disabled={enviar.isPending}
            />
          </div>
        ) : null}

        {isMetaCloud ? (
          <>
            {(memorizados.data?.length ?? 0) > 0 ? (
              <div className="space-y-1.5">
                <Label>Memorizados</Label>
                <Select onValueChange={aplicarMemorizado} disabled={enviar.isPending}>
                  <SelectTrigger>
                    <SelectValue placeholder="Usar template salvo" />
                  </SelectTrigger>
                  <SelectContent>
                    {memorizados.data!.map((m) => (
                      <SelectItem key={m.id} value={m.id}>
                        {m.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : null}
            <div className="space-y-1.5">
              <Label>Modelo ({rotuloProvedor("meta_cloud")})</Label>
              {templates.isLoading ? (
                <p className="text-xs text-muted-foreground">Carregando modelos…</p>
              ) : templatesAprovados.length === 0 ? (
                <p className="text-xs text-muted-foreground">
                  Nenhum modelo aprovado nesta conexão.
                </p>
              ) : (
                <Select
                  value={templateId}
                  onValueChange={(id) => {
                    setTemplateId(id);
                    const tpl = templatesAprovados.find((t) => t.id === id);
                    if (tpl && extrairIndicesVariaveisTemplate(tpl.componentes).length > 0) {
                      setModalVariaveisAberto(true);
                    }
                  }}
                  disabled={enviar.isPending}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o template" />
                  </SelectTrigger>
                  <SelectContent>
                    {templatesAprovados.map((t) => (
                      <SelectItem key={t.id} value={t.id}>
                        {t.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              {previewCorpo ? (
                <p className="line-clamp-2 text-xs text-muted-foreground">{previewCorpo}</p>
              ) : null}
              {templateId && indicesVariaveis.length > 0 ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setModalVariaveisAberto(true)}
                >
                  Configurar variáveis
                </Button>
              ) : null}
            </div>
          </>
        ) : null}

        {erro ? <p className="text-sm text-destructive">{erro}</p> : null}

        <Button type="submit" className="w-full" disabled={!podeEnviar() || enviar.isPending}>
          {enviar.isPending ? "Enviando…" : "Enviar"}
        </Button>
      </form>

      <Dialog open={modalVariaveisAberto} onOpenChange={setModalVariaveisAberto}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Variáveis do template</DialogTitle>
            <DialogDescription>
              Preencha os campos do modelo e, se quiser, memorize para reutilizar.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            {indicesVariaveis.map((indice) => (
              <div key={indice} className="space-y-1.5">
                <Label htmlFor={`var-${indice}`}>Variável {indice}</Label>
                <Input
                  id={`var-${indice}`}
                  value={variaveis[indice] ?? ""}
                  onChange={(e) => setVariaveis((prev) => ({ ...prev, [indice]: e.target.value }))}
                />
              </div>
            ))}
            <div className="flex items-center gap-2 pt-1">
              <Checkbox
                id="memorizar-template"
                checked={memorizar}
                onCheckedChange={(v) => setMemorizar(v === true)}
              />
              <Label htmlFor="memorizar-template" className="font-normal">
                Memorizar este template
              </Label>
            </div>
            {memorizar ? (
              <div className="space-y-1.5">
                <Label htmlFor="nome-memoria">Nome para reutilizar</Label>
                <Input
                  id="nome-memoria"
                  value={nomeMemoria}
                  onChange={(e) => setNomeMemoria(e.target.value)}
                  placeholder="Ex.: Boas-vindas promo"
                />
              </div>
            ) : null}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setModalVariaveisAberto(false)}>
              Cancelar
            </Button>
            <Button
              type="button"
              disabled={
                enviar.isPending ||
                indicesVariaveis.some((i) => !variaveis[i]?.trim()) ||
                (memorizar && !nomeMemoria.trim())
              }
              onClick={() => {
                if (enviosRecentes + 1 >= alertaConsecutivos) {
                  setModalVariaveisAberto(false);
                  setAlertaAberto(true);
                  return;
                }
                disparar(false);
              }}
            >
              Enviar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={alertaAberto} onOpenChange={setAlertaAberto}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Envio em ritmo alto</AlertDialogTitle>
            <AlertDialogDescription>
              Você está enviando muitas mensagens em pouco tempo ({enviosRecentes + 1} próximos do
              limite de alerta de {alertaConsecutivos}). Continuar pode aumentar o risco de
              restrições no WhatsApp.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setAlertaAberto(false);
                disparar(true);
              }}
            >
              Continuar mesmo assim
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
