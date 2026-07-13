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
import { Checkbox } from "@whasap/ui/components/checkbox";
import { Label } from "@whasap/ui/components/label";
import { useState } from "react";

import { instanciaOperacional } from "@/lib/instancia-status";
import { orpc, type InstanciaItem } from "@/lib/orpc";
import { getOrpcErrorMessage } from "@/lib/orpc-error";

type Props = {
  inst: InstanciaItem;
  organizacaoHash: string;
};

/**
 * Desconecta WhatsApp com confirmação; opção de excluir conversas/mensagens
 * (e remover a conexão do painel quando não há assinatura).
 */
export function DesconectarInstanciaButton({ inst, organizacaoHash }: Props) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [excluirDados, setExcluirDados] = useState(false);

  const operacional = instanciaOperacional(inst.status);
  const temAssinatura = Boolean(inst.asaasSubscriptionId);
  const modoExcluirSomente = !operacional;

  const desconectar = useMutation(
    orpc.instancia.desconectar.mutationOptions({
      onSuccess: async () => {
        setOpen(false);
        setExcluirDados(false);
        await queryClient.invalidateQueries({
          queryKey: orpc.instancia.lista.key({ input: { organizacaoHash } }),
        });
        await queryClient.invalidateQueries({
          queryKey: orpc.caixaEntrada.conversas.lista.key(),
        });
      },
    }),
  );

  if (inst.status === "deactivated") return null;
  if (!operacional && temAssinatura) return null;

  const titulo = modoExcluirSomente
    ? "Excluir conexão?"
    : excluirDados
      ? "Desconectar e excluir dados?"
      : "Desconectar WhatsApp?";

  const descricao = modoExcluirSomente
    ? `A conexão “${inst.nome}” será removida do painel. Conversas e mensagens deste número serão excluídas.`
    : excluirDados
      ? temAssinatura
        ? `O WhatsApp “${inst.nome}” será desconectado e as conversas/mensagens serão excluídas. A conexão permanece no painel por causa da assinatura ativa.`
        : `O WhatsApp “${inst.nome}” será desconectado, as conversas/mensagens serão excluídas e a conexão sairá do painel.`
      : `O WhatsApp “${inst.nome}” será desconectado deste dispositivo. Você poderá reconectar depois; as conversas ficam no painel.`;

  const labelAcao = modoExcluirSomente
    ? desconectar.isPending
      ? "Excluindo…"
      : "Excluir"
    : desconectar.isPending
      ? "Desconectando…"
      : excluirDados
        ? "Desconectar e excluir"
        : "Desconectar";

  return (
    <>
      <Button
        size="sm"
        variant="outline"
        className={modoExcluirSomente ? "text-destructive" : undefined}
        onClick={() => {
          setExcluirDados(modoExcluirSomente);
          setOpen(true);
        }}
      >
        {modoExcluirSomente ? "Excluir" : "Desconectar"}
      </Button>

      <AlertDialog
        open={open}
        onOpenChange={(next) => {
          if (desconectar.isPending) return;
          setOpen(next);
          if (!next) setExcluirDados(false);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{titulo}</AlertDialogTitle>
            <AlertDialogDescription>{descricao}</AlertDialogDescription>
          </AlertDialogHeader>

          {operacional ? (
            <div className="flex items-start gap-3 rounded-md border border-border p-3">
              <Checkbox
                id={`excluir-dados-${inst.id}`}
                checked={excluirDados}
                disabled={desconectar.isPending}
                onCheckedChange={(v) => setExcluirDados(v === true)}
              />
              <div className="grid gap-1">
                <Label htmlFor={`excluir-dados-${inst.id}`} className="cursor-pointer font-medium">
                  Excluir dados relacionados a este número
                </Label>
                <p className="text-xs text-muted-foreground">
                  Remove conversas e mensagens do painel
                  {temAssinatura
                    ? ". A conexão permanece por causa da assinatura."
                    : " e remove a conexão da lista."}
                </p>
              </div>
            </div>
          ) : null}

          {desconectar.error ? (
            <p className="text-sm text-destructive">
              {getOrpcErrorMessage(desconectar.error, "Não foi possível concluir a ação.")}
            </p>
          ) : null}

          <AlertDialogFooter>
            <AlertDialogCancel disabled={desconectar.isPending}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              disabled={desconectar.isPending}
              className={
                modoExcluirSomente || excluirDados
                  ? "bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  : undefined
              }
              onClick={(e) => {
                e.preventDefault();
                desconectar.mutate({
                  instanciaId: inst.id,
                  excluirDados: modoExcluirSomente || excluirDados,
                });
              }}
            >
              {labelAcao}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
