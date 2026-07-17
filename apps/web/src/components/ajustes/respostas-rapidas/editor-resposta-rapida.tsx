import { skipToken, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@whasap/ui/components/button";
import { Input } from "@whasap/ui/components/input";
import { Label } from "@whasap/ui/components/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@whasap/ui/components/select";
import { ArrowLeft, Loader2 } from "lucide-react";
import { useEffect, useId, useState } from "react";

import { orpc, orpcClient } from "@/lib/orpc";
import { getOrpcErrorMessage } from "@/lib/orpc-error";

import { invalidarListaRespostasRapidas } from "./invalidar-lista";
import { ItemRespostaMidia } from "./item-resposta-midia";
import { ItemRespostaTexto } from "./item-resposta-texto";
import { criarItemVazio, type ItemForm, type TipoItem } from "./tipos";

const OPCOES_INTERVALO = [
  { valor: 0, rotulo: "Sem intervalo" },
  { valor: 1, rotulo: "1 segundo" },
  { valor: 2, rotulo: "2 segundos" },
  { valor: 3, rotulo: "3 segundos" },
  { valor: 5, rotulo: "5 segundos" },
  { valor: 10, rotulo: "10 segundos" },
  { valor: 15, rotulo: "15 segundos" },
  { valor: 30, rotulo: "30 segundos" },
] as const;

const INTERVALO_PADRAO = 1;

type EditorRespostaRapidaProps = {
  organizacaoHash: string;
  /** `null` = criar; uuid = editar */
  respostaId: string | null;
  onFechar: () => void;
};

type PayloadSalvar = {
  organizacaoHash: string;
  id?: string;
  titulo: string;
  intervaloSegundos: number;
  itens: Array<{
    tipo: TipoItem;
    corpo: string | null;
    mediaR2Key: string | null;
    nomeArquivo: string | null;
  }>;
};

/**
 * Formulário criar/editar no painel principal (master-detail).
 * Hooks: `useQuery` obter (só edição) + `useMutation` salvar unificado.
 */
export function EditorRespostaRapida({
  organizacaoHash,
  respostaId,
  onFechar,
}: EditorRespostaRapidaProps) {
  const queryClient = useQueryClient();
  const tituloId = useId();
  const intervaloId = useId();
  const [titulo, setTitulo] = useState("");
  const [intervaloSegundos, setIntervaloSegundos] = useState(INTERVALO_PADRAO);
  const [itens, setItens] = useState<ItemForm[]>([criarItemVazio("text")]);
  const [erroForm, setErroForm] = useState<string | null>(null);
  const [formPronto, setFormPronto] = useState(!respostaId);

  const detalhe = useQuery(
    orpc.caixaEntrada.respostasRapidas.obter.queryOptions({
      input: respostaId ? { organizacaoHash, id: respostaId } : skipToken,
    }),
  );

  useEffect(() => {
    if (!respostaId) {
      setTitulo("");
      setIntervaloSegundos(INTERVALO_PADRAO);
      setItens([criarItemVazio("text")]);
      setErroForm(null);
      setFormPronto(true);
      return;
    }
    setFormPronto(false);
    setErroForm(null);
  }, [respostaId]);

  useEffect(() => {
    if (!respostaId || !detalhe.data) return;
    setTitulo(detalhe.data.titulo);
    setIntervaloSegundos(detalhe.data.intervaloSegundos);
    setItens(
      detalhe.data.itens.map((item) => ({
        chaveLocal: item.id,
        tipo: item.tipo,
        corpo: item.corpo ?? "",
        mediaR2Key: item.mediaR2Key,
        mediaUrl: item.mediaUrl,
        nomeArquivo: item.nomeArquivo,
      })),
    );
    setFormPronto(true);
  }, [respostaId, detalhe.data]);

  useEffect(() => {
    if (!respostaId || !detalhe.isError) return;
    setErroForm(getOrpcErrorMessage(detalhe.error, "Não foi possível carregar a resposta."));
    setFormPronto(true);
  }, [respostaId, detalhe.isError, detalhe.error]);

  const salvar = useMutation({
    mutationFn: async (payload: PayloadSalvar) => {
      if (payload.id) {
        return orpcClient.caixaEntrada.respostasRapidas.atualizar({
          organizacaoHash: payload.organizacaoHash,
          id: payload.id,
          titulo: payload.titulo,
          intervaloSegundos: payload.intervaloSegundos,
          itens: payload.itens,
        });
      }
      return orpcClient.caixaEntrada.respostasRapidas.criar({
        organizacaoHash: payload.organizacaoHash,
        titulo: payload.titulo,
        intervaloSegundos: payload.intervaloSegundos,
        itens: payload.itens,
      });
    },
    onSuccess: () => {
      invalidarListaRespostasRapidas(queryClient, organizacaoHash);
      onFechar();
    },
  });

  function atualizarItem(chaveLocal: string, patch: Partial<ItemForm>) {
    setItens((atual) =>
      atual.map((item) => (item.chaveLocal === chaveLocal ? { ...item, ...patch } : item)),
    );
  }

  function moverItem(chaveLocal: string, direcao: -1 | 1) {
    setItens((atual) => {
      const idx = atual.findIndex((item) => item.chaveLocal === chaveLocal);
      const destino = idx + direcao;
      if (idx < 0 || destino < 0 || destino >= atual.length) return atual;
      const copia = [...atual];
      const [removido] = copia.splice(idx, 1);
      copia.splice(destino, 0, removido!);
      return copia;
    });
  }

  function submeter() {
    setErroForm(null);
    if (!titulo.trim()) {
      setErroForm("Informe um título.");
      return;
    }
    if (itens.length === 0) {
      setErroForm("Adicione ao menos uma mensagem.");
      return;
    }
    for (const [i, item] of itens.entries()) {
      if (item.tipo === "text" && !item.corpo.trim()) {
        setErroForm(`Mensagem ${i + 1}: texto obrigatório.`);
        return;
      }
      if (item.tipo !== "text" && !item.mediaR2Key) {
        setErroForm(`Mensagem ${i + 1}: envie o arquivo.`);
        return;
      }
    }

    salvar.mutate({
      organizacaoHash,
      id: respostaId ?? undefined,
      titulo: titulo.trim(),
      intervaloSegundos,
      itens: itens.map((item) => ({
        tipo: item.tipo,
        corpo: item.corpo.trim() || null,
        mediaR2Key: item.mediaR2Key,
        nomeArquivo: item.nomeArquivo,
      })),
    });
  }

  const carregandoDetalhe = Boolean(respostaId) && detalhe.isLoading;
  const podeSalvar = formPronto && !carregandoDetalhe && !salvar.isPending;

  return (
    <div className="flex h-full min-h-0 flex-col">
      <header className="flex shrink-0 items-center justify-between gap-3 border-b border-wa-divider px-4 py-3 md:px-6">
        <div className="flex min-w-0 items-center gap-2">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="md:hidden"
            onClick={onFechar}
            aria-label="Voltar"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <h2 className="truncate text-lg font-semibold text-wa-text">
            {respostaId ? "Editar resposta" : "Nova resposta rápida"}
          </h2>
        </div>
        <div className="flex shrink-0 gap-2">
          <Button variant="outline" size="sm" onClick={onFechar} disabled={salvar.isPending}>
            Cancelar
          </Button>
          <Button size="sm" onClick={submeter} disabled={!podeSalvar}>
            {salvar.isPending ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : null}
            Salvar
          </Button>
        </div>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 md:px-6">
        {carregandoDetalhe ? (
          <p className="flex items-center gap-2 text-sm text-wa-text-muted">
            <Loader2 className="h-4 w-4 animate-spin" />
            Carregando…
          </p>
        ) : (
          <div className="mx-auto max-w-lg space-y-4">
            <div className="space-y-2">
              <Label htmlFor={tituloId}>Título</Label>
              <Input
                id={tituloId}
                value={titulo}
                onChange={(e) => setTitulo(e.target.value)}
                placeholder="Ex.: Boas-vindas"
                maxLength={120}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor={intervaloId}>Tempo entre mensagens</Label>
              <Select
                value={String(intervaloSegundos)}
                onValueChange={(v) => setIntervaloSegundos(Number(v))}
              >
                <SelectTrigger id={intervaloId}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {OPCOES_INTERVALO.map((opcao) => (
                    <SelectItem key={opcao.valor} value={String(opcao.valor)}>
                      {opcao.rotulo}
                    </SelectItem>
                  ))}
                  {!OPCOES_INTERVALO.some((o) => o.valor === intervaloSegundos) ? (
                    <SelectItem value={String(intervaloSegundos)}>
                      {intervaloSegundos} {intervaloSegundos === 1 ? "segundo" : "segundos"}
                    </SelectItem>
                  ) : null}
                </SelectContent>
              </Select>
              <p className="text-xs text-wa-text-muted">
                Pausa entre cada mensagem da sequência ao enviar na conversa.
              </p>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <Label>Mensagens</Label>
                <div className="flex flex-wrap gap-1">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setItens((a) => [...a, criarItemVazio("text")])}
                  >
                    + Texto
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setItens((a) => [...a, criarItemVazio("image")])}
                  >
                    + Imagem
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setItens((a) => [...a, criarItemVazio("document")])}
                  >
                    + Doc
                  </Button>
                </div>
              </div>

              <div className="space-y-3">
                {itens.map((item, idx) =>
                  item.tipo === "text" ? (
                    <ItemRespostaTexto
                      key={item.chaveLocal}
                      item={item}
                      indice={idx}
                      total={itens.length}
                      onChange={(patch) => atualizarItem(item.chaveLocal, patch)}
                      onMover={(dir) => moverItem(item.chaveLocal, dir)}
                      onRemover={() =>
                        setItens((a) => a.filter((x) => x.chaveLocal !== item.chaveLocal))
                      }
                    />
                  ) : (
                    <ItemRespostaMidia
                      key={item.chaveLocal}
                      organizacaoHash={organizacaoHash}
                      item={item}
                      indice={idx}
                      total={itens.length}
                      onChange={(patch) => atualizarItem(item.chaveLocal, patch)}
                      onMover={(dir) => moverItem(item.chaveLocal, dir)}
                      onRemover={() =>
                        setItens((a) => a.filter((x) => x.chaveLocal !== item.chaveLocal))
                      }
                    />
                  ),
                )}
              </div>
            </div>

            {(erroForm || salvar.error) && (
              <p className="text-sm text-destructive">
                {erroForm || getOrpcErrorMessage(salvar.error, "Não foi possível salvar.")}
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
