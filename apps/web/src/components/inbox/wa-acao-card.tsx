import { useMutation, useQueryClient } from "@tanstack/react-query";
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
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@whasap/ui/components/card";
import { Input } from "@whasap/ui/components/input";
import { useState, type ReactNode } from "react";

import { orgInput } from "@/lib/org-input";
import { orpc } from "@/lib/orpc";
import { getOrpcErrorMessage } from "@/lib/orpc-error";

type MutacaoAfetadas = (input: {
  organizacaoHash: string;
  instanciaId?: string;
}) => Promise<{ afetadas: number }>;

type WaAcaoCardProps = {
  organizacaoHash: string;
  titulo: string;
  descricao: string;
  contagem: number;
  contagemLabel?: string;
  rotuloBotao: string;
  variante?: "default" | "destructive";
  disabled?: boolean;
  /** Se definido, exige digitar este texto para confirmar. */
  confirmarTexto?: string;
  executar: MutacaoAfetadas;
  extras?: ReactNode;
};

/** Card de ação em massa com AlertDialog e contagem afetada. */
export function WaAcaoCard({
  organizacaoHash,
  titulo,
  descricao,
  contagem,
  contagemLabel = "conversas",
  rotuloBotao,
  variante = "default",
  disabled,
  confirmarTexto,
  executar,
  extras,
}: WaAcaoCardProps) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [digitado, setDigitado] = useState("");
  const [resultado, setResultado] = useState<string | null>(null);

  const mutacao = useMutation({
    mutationFn: () => executar({ organizacaoHash }),
    onSuccess: async (data) => {
      setOpen(false);
      setDigitado("");
      setResultado(`${data.afetadas} ${contagemLabel} afetada(s).`);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: orpc.acoes.resumo.key() }),
        queryClient.invalidateQueries({ queryKey: orpc.caixaEntrada.conversas.lista.key() }),
        queryClient.invalidateQueries({ queryKey: orpc.caixaEntrada.contatos.lista.key() }),
      ]);
    },
  });

  const podeConfirmar =
    !mutacao.isPending &&
    contagem > 0 &&
    (!confirmarTexto || digitado.trim().toUpperCase() === confirmarTexto);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">{titulo}</CardTitle>
        <CardDescription>{descricao}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm text-wa-text">
          <span className="font-semibold tabular-nums">{contagem}</span>{" "}
          <span className="text-wa-text-muted">{contagemLabel}</span>
        </p>
        {extras}
        <Button
          variant={variante === "destructive" ? "destructive" : "outline"}
          size="sm"
          disabled={disabled || contagem === 0 || mutacao.isPending}
          onClick={() => {
            setResultado(null);
            setOpen(true);
          }}
        >
          {rotuloBotao}
        </Button>
        {resultado ? <p className="text-sm text-wa-text-muted">{resultado}</p> : null}
        {mutacao.error ? (
          <p className="text-sm text-destructive">
            {getOrpcErrorMessage(mutacao.error, "Não foi possível concluir a ação.")}
          </p>
        ) : null}
      </CardContent>

      <AlertDialog
        open={open}
        onOpenChange={(next) => {
          if (mutacao.isPending) return;
          setOpen(next);
          if (!next) setDigitado("");
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{titulo}</AlertDialogTitle>
            <AlertDialogDescription>
              {descricao} Isso afeta{" "}
              <strong>
                {contagem} {contagemLabel}
              </strong>
              .
            </AlertDialogDescription>
          </AlertDialogHeader>
          {confirmarTexto ? (
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">
                Digite <span className="font-mono font-semibold">{confirmarTexto}</span> para
                confirmar.
              </p>
              <Input
                value={digitado}
                onChange={(e) => setDigitado(e.target.value)}
                placeholder={confirmarTexto}
                disabled={mutacao.isPending}
                autoComplete="off"
              />
            </div>
          ) : null}
          {mutacao.error ? (
            <p className="text-sm text-destructive">
              {getOrpcErrorMessage(mutacao.error, "Não foi possível concluir a ação.")}
            </p>
          ) : null}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={mutacao.isPending}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              disabled={!podeConfirmar}
              className={
                variante === "destructive"
                  ? "bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  : undefined
              }
              onClick={(e) => {
                e.preventDefault();
                mutacao.mutate();
              }}
            >
              {mutacao.isPending ? "Aplicando…" : rotuloBotao}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}

/** Invalida resumo + listas após mutação de org (ex.: horas auto-fechar). */
export async function invalidarAposAcao(queryClient: ReturnType<typeof useQueryClient>) {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: orpc.acoes.resumo.key() }),
    queryClient.invalidateQueries({ queryKey: orpc.organizacao.obter.key() }),
    queryClient.invalidateQueries({ queryKey: orpc.caixaEntrada.conversas.lista.key() }),
    queryClient.invalidateQueries({ queryKey: orpc.caixaEntrada.contatos.lista.key() }),
  ]);
}

export function useAcoesResumo(organizacaoHash: string | undefined) {
  return {
    ...orpc.acoes.resumo.queryOptions({
      input: orgInput(organizacaoHash),
    }),
  };
}
