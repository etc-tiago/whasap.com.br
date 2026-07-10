import { useState } from "react";
import { AlertTriangle, Clock } from "lucide-react";
import { Button } from "@whasap/ui/components/button";
import { cn } from "@whasap/ui/lib/utils";

import { ConfigurarPagamentoDialog } from "@/components/configurar-pagamento-dialog";
import type { orpcClient } from "@/lib/orpc";

type Demonstracao = Awaited<ReturnType<typeof orpcClient.organizacao.obter>>["demonstracao"];

type Props = {
  demonstracao: Demonstracao;
  isAdmin: boolean;
  instanciaId: string | null;
  instanciaNome: string | null;
};

export function DemonstracaoBanner({ demonstracao, isAdmin, instanciaId, instanciaNome }: Props) {
  const [dialogOpen, setDialogOpen] = useState(false);

  if (demonstracao.estado === "livre" || demonstracao.estado === "pago") {
    return null;
  }

  const isBloqueado = demonstracao.estado === "bloqueado";
  const dias = demonstracao.diasRestantes ?? 0;
  const diasLabel =
    dias === 1 ? "Resta 1 dia de demonstração" : `Restam ${dias} dias de demonstração`;

  return (
    <>
      <div
        className={cn(
          "flex flex-wrap items-center justify-between gap-3 border-b px-4 py-3 text-sm",
          isBloqueado
            ? "border-destructive/30 bg-destructive/10 text-destructive"
            : "border-wa-green/30 bg-wa-green/10 text-wa-green-dark",
        )}
      >
        <div className="flex items-start gap-2">
          {isBloqueado ? (
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          ) : (
            <Clock className="mt-0.5 h-4 w-4 shrink-0" />
          )}
          <div>
            <p className="font-medium">
              {isBloqueado ? "Período de demonstração encerrado" : diasLabel}
            </p>
            <p
              className={cn(
                "mt-0.5 text-xs",
                isBloqueado ? "text-destructive/90" : "text-wa-green-dark/80",
              )}
            >
              {isBloqueado
                ? "Configure o método de pagamento para voltar a usar o painel."
                : "Configure o pagamento antes do fim da demonstração para não interromper o serviço."}
            </p>
          </div>
        </div>
        {isAdmin && instanciaId && instanciaNome ? (
          <Button
            size="sm"
            variant={isBloqueado ? "destructive" : "default"}
            className={cn(!isBloqueado && "bg-wa-green hover:bg-wa-green-dark")}
            onClick={() => setDialogOpen(true)}
          >
            Configurar pagamento
          </Button>
        ) : (
          !isAdmin &&
          isBloqueado && (
            <p className="text-xs">
              Peça ao administrador da organização para configurar o pagamento.
            </p>
          )
        )}
      </div>
      {instanciaId && instanciaNome && (
        <ConfigurarPagamentoDialog
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          instanciaId={instanciaId}
          instanciaNome={instanciaNome}
        />
      )}
    </>
  );
}
