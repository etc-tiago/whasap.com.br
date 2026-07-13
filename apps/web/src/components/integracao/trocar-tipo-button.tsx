import { useMutation } from "@tanstack/react-query";
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
import { useState } from "react";

import { getOrpcErrorMessage } from "@/lib/orpc-error";
import { orpc } from "@/lib/orpc";

type Props = {
  instanciaId: string;
  onSucesso: () => void;
  variant?: "ghost" | "outline";
};

/** Descarta instância em onboarding e volta ao passo de escolha de tipo. */
export function TrocarTipoButton({ instanciaId, onSucesso, variant = "ghost" }: Props) {
  const [open, setOpen] = useState(false);
  const descartar = useMutation(
    orpc.instancia.descartar.mutationOptions({
      onSuccess: () => {
        setOpen(false);
        onSucesso();
      },
    }),
  );

  return (
    <div className="space-y-2">
      <Button
        type="button"
        variant={variant}
        className="w-full"
        disabled={descartar.isPending}
        onClick={() => setOpen(true)}
      >
        Trocar tipo de conexão
      </Button>

      <AlertDialog
        open={open}
        onOpenChange={(next) => {
          if (descartar.isPending) return;
          setOpen(next);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Trocar tipo de conexão?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta conexão em configuração será removida. Você poderá escolher outro tipo e começar
              de novo.
            </AlertDialogDescription>
          </AlertDialogHeader>
          {descartar.isError ? (
            <p className="text-sm text-destructive">
              {getOrpcErrorMessage(descartar.error, "Não foi possível remover a instância.")}
            </p>
          ) : null}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={descartar.isPending}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              disabled={descartar.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={(e) => {
                e.preventDefault();
                descartar.mutate({ instanciaId });
              }}
            >
              {descartar.isPending ? "Removendo…" : "Remover e trocar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
