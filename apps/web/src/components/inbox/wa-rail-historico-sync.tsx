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
import { cn } from "@whasap/ui/lib/utils";
import { AlertCircle, Check, History, Loader2 } from "lucide-react";
import { useState } from "react";

import {
  historicoSyncEmAndamento,
  historicoSyncStatusDe,
  rotuloHistoricoSync,
} from "@/lib/historico-sync";
import { orpc, type InstanciaItem } from "@/lib/orpc";
import { getOrpcErrorMessage } from "@/lib/orpc-error";

type WaRailHistoricoSyncProps = {
  organizacaoHash: string;
  instanciaEvo: InstanciaItem | null;
};

/** Botão do rail + confirmação para sincronizar histórico Evolution. */
export function WaRailHistoricoSync({ organizacaoHash, instanciaEvo }: WaRailHistoricoSyncProps) {
  const queryClient = useQueryClient();
  const [confirmOpen, setConfirmOpen] = useState(false);

  const syncStatus = instanciaEvo ? historicoSyncStatusDe(instanciaEvo) : "idle";
  const syncing = instanciaEvo ? historicoSyncEmAndamento(instanciaEvo) : false;

  const sincronizar = useMutation(
    orpc.instancia.sincronizarHistorico.mutationOptions({
      onSuccess: async () => {
        setConfirmOpen(false);
        await queryClient.invalidateQueries({
          queryKey: orpc.instancia.lista.key({ input: { organizacaoHash } }),
        });
      },
    }),
  );

  return (
    <>
      <button
        type="button"
        title={
          instanciaEvo
            ? rotuloHistoricoSync(instanciaEvo)
            : "Sincronizar histórico (WhatsApp Comercial)"
        }
        aria-label="Sincronizar histórico"
        disabled={!instanciaEvo || syncing || sincronizar.isPending}
        onClick={() => setConfirmOpen(true)}
        className={cn(
          "relative flex h-11 w-11 items-center justify-center rounded-lg transition-colors",
          "text-wa-icon hover:bg-wa-hover disabled:cursor-not-allowed disabled:opacity-50",
          syncStatus === "failed" && "text-destructive",
          syncStatus === "completed" && "text-wa-green-dark",
        )}
      >
        {syncing || sincronizar.isPending ? (
          <Loader2 className="size-5 animate-spin" />
        ) : syncStatus === "failed" ? (
          <AlertCircle className="size-5" />
        ) : syncStatus === "completed" ? (
          <span className="relative">
            <History className="size-5" />
            <Check className="absolute -bottom-0.5 -right-0.5 size-2.5" />
          </span>
        ) : (
          <History className="size-5" />
        )}
        {syncStatus === "running" || syncStatus === "requested" ? (
          <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-wa-green" />
        ) : null}
      </button>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {syncStatus === "failed" ? "Tentar sincronizar de novo?" : "Sincronizar histórico?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {syncStatus === "failed" && instanciaEvo?.evoHistoricoSyncErro ? (
                <>
                  A última tentativa falhou: {instanciaEvo.evoHistoricoSyncErro}. Podemos pedir o
                  histórico de novo
                  {instanciaEvo ? ` de “${instanciaEvo.nome}”` : ""} e processar em segundo plano.
                </>
              ) : (
                <>
                  Vamos pedir o histórico do WhatsApp
                  {instanciaEvo ? ` de “${instanciaEvo.nome}”` : ""} e processar em segundo plano.
                  Pode levar alguns minutos.
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          {sincronizar.error ? (
            <p className="text-sm text-destructive">
              {getOrpcErrorMessage(sincronizar.error, "Erro ao iniciar sincronização")}
            </p>
          ) : null}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={sincronizar.isPending}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              disabled={!instanciaEvo || sincronizar.isPending}
              onClick={(e) => {
                e.preventDefault();
                if (!instanciaEvo) return;
                sincronizar.mutate({ instanciaId: instanciaEvo.id });
              }}
            >
              {sincronizar.isPending
                ? "Iniciando…"
                : syncStatus === "failed"
                  ? "Tentar de novo"
                  : "Sincronizar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
