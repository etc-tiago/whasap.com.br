import { useMutation } from "@tanstack/react-query";
import { Button } from "@whasap/ui/components/button";

import { getOrpcErrorMessage } from "@/lib/orpc-error";
import { orpc } from "@/lib/orpc";

type Props = {
  instanciaId: string;
  onSucesso: () => void;
  variant?: "ghost" | "outline";
};

/** Descarta instância em onboarding e volta ao passo de escolha de tipo. */
export function TrocarTipoButton({ instanciaId, onSucesso, variant = "ghost" }: Props) {
  const descartar = useMutation(
    orpc.instancia.descartar.mutationOptions({
      onSuccess: () => onSucesso(),
    }),
  );

  return (
    <div className="space-y-2">
      <Button
        type="button"
        variant={variant}
        className="w-full"
        disabled={descartar.isPending}
        onClick={() => descartar.mutate({ instanciaId })}
      >
        {descartar.isPending ? "Removendo..." : "Trocar tipo de conexão"}
      </Button>
      {descartar.isError ? (
        <p className="text-center text-xs text-destructive">
          {getOrpcErrorMessage(descartar.error, "Não foi possível remover a instância.")}
        </p>
      ) : null}
    </div>
  );
}
