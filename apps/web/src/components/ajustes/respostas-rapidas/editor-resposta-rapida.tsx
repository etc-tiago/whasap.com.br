import { skipToken, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@whasap/ui/components/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@whasap/ui/components/dialog";
import { Input } from "@whasap/ui/components/input";
import { Label } from "@whasap/ui/components/label";
import { Loader2 } from "lucide-react";
import { useEffect, useId, useState } from "react";

import { orpc, orpcClient } from "@/lib/orpc";
import { getOrpcErrorMessage } from "@/lib/orpc-error";

import { invalidarListaRespostasRapidas } from "./invalidar-lista";
import { ItemRespostaMidia } from "./item-resposta-midia";
import { ItemRespostaTexto } from "./item-resposta-texto";
import { criarItemVazio, type ItemForm, type TipoItem } from "./tipos";

type EditorRespostaRapidaProps = {
  organizacaoHash: string;
  aberto: boolean;
  /** `null` = criar; uuid = editar */
  respostaId: string | null;
  onFechar: () => void;
};

type PayloadSalvar = {
  organizacaoHash: string;
  id?: string;
  titulo: string;
  itens: Array<{
    tipo: TipoItem;
    corpo: string | null;
    mediaR2Key: string | null;
    nomeArquivo: string | null;
  }>;
};

/**
 * Dialog criar/editar.
 * Hooks: `useQuery` obter (só edição) + `useMutation` salvar unificado.
 */
export function EditorRespostaRapida({
  organizacaoHash,
  aberto,
  respostaId,
  onFechar,
}: EditorRespostaRapidaProps) {
  const queryClient = useQueryClient();
  const tituloId = useId();
  const [titulo, setTitulo] = useState("");
  const [itens, setItens] = useState<ItemForm[]>([criarItemVazio("text")]);
  const [erroForm, setErroForm] = useState<string | null>(null);
  const [formPronto, setFormPronto] = useState(!respostaId);

  const detalhe = useQuery(
    orpc.caixaEntrada.respostasRapidas.obter.queryOptions({
      input: aberto && respostaId ? { organizacaoHash, id: respostaId } : skipToken,
    }),
  );

  useEffect(() => {
    if (!aberto) return;
    if (!respostaId) {
      setTitulo("");
      setItens([criarItemVazio("text")]);
      setErroForm(null);
      setFormPronto(true);
      return;
    }
    setFormPronto(false);
    setErroForm(null);
  }, [aberto, respostaId]);

  useEffect(() => {
    if (!aberto || !respostaId || !detalhe.data) return;
    setTitulo(detalhe.data.titulo);
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
  }, [aberto, respostaId, detalhe.data]);

  useEffect(() => {
    if (!aberto || !respostaId || !detalhe.isError) return;
    setErroForm(getOrpcErrorMessage(detalhe.error, "Não foi possível carregar a resposta."));
    setFormPronto(true);
  }, [aberto, respostaId, detalhe.isError, detalhe.error]);

  const salvar = useMutation({
    mutationFn: async (payload: PayloadSalvar) => {
      if (payload.id) {
        return orpcClient.caixaEntrada.respostasRapidas.atualizar({
          organizacaoHash: payload.organizacaoHash,
          id: payload.id,
          titulo: payload.titulo,
          itens: payload.itens,
        });
      }
      return orpcClient.caixaEntrada.respostasRapidas.criar({
        organizacaoHash: payload.organizacaoHash,
        titulo: payload.titulo,
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
    <Dialog open={aberto} onOpenChange={(proximo) => (!proximo ? onFechar() : null)}>
      <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{respostaId ? "Editar resposta" : "Nova resposta rápida"}</DialogTitle>
        </DialogHeader>

        {carregandoDetalhe ? (
          <p className="flex items-center gap-2 text-sm text-wa-text-muted">
            <Loader2 className="h-4 w-4 animate-spin" />
            Carregando…
          </p>
        ) : (
          <div className="space-y-4">
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
              <div className="flex items-center justify-between gap-2">
                <Label>Mensagens</Label>
                <div className="flex gap-1">
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

        <DialogFooter>
          <Button variant="outline" onClick={onFechar} disabled={salvar.isPending}>
            Cancelar
          </Button>
          <Button onClick={submeter} disabled={!podeSalvar}>
            {salvar.isPending ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : null}
            Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
