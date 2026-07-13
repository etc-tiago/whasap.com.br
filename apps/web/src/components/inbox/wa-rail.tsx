import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { isEvoProvider } from "@whasap/config";
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
import {
  AlertCircle,
  ChartArea,
  Check,
  History,
  Loader2,
  MessageCircle,
  Settings,
  Users,
} from "lucide-react";
import { useState, type ReactNode } from "react";

import { WaRailLink, waRailLinkActiveOptionsExact } from "@/components/inbox/wa-rail-link";
import { WaRailProfile } from "@/components/inbox/wa-rail-profile";
import { WaRailTheme } from "@/components/inbox/wa-rail-theme";
import {
  historicoSyncEmAndamento,
  historicoSyncStatusDe,
  rotuloHistoricoSync,
} from "@/lib/historico-sync";
import { instanciaOperacional } from "@/lib/instancia-status";
import { orgInput } from "@/lib/org-input";
import { orpc } from "@/lib/orpc";
import { getOrpcErrorMessage } from "@/lib/orpc-error";

type WaRailProps = {
  organizacaoHash: string;
};

export function WaRail({ organizacaoHash }: WaRailProps) {
  const queryClient = useQueryClient();
  const [confirmOpen, setConfirmOpen] = useState(false);

  const instancias = useQuery({
    ...orpc.instancia.lista.queryOptions({ input: orgInput(organizacaoHash) }),
    refetchInterval: (q) => {
      const lista = q.state.data ?? [];
      return lista.some((i) => historicoSyncEmAndamento(i)) ? 5_000 : false;
    },
  });

  const instanciaInbox = instancias.data?.find((i) => instanciaOperacional(i.status));
  const instanciaEvo =
    instancias.data?.find(
      (i) =>
        isEvoProvider(i.provider) &&
        (i.status === "connected" || i.status === "pending_payment"),
    ) ?? null;

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
    <aside className="hidden w-14 shrink-0 flex-col items-center justify-between border-r border-wa-divider bg-wa-sidebar py-3 md:flex">
      <div className="flex flex-col items-center gap-1">
        {instanciaInbox ? (
          <WaRailLink
            to="/$organizacaoHash/inbox"
            params={{ organizacaoHash }}
            title="Conversas"
            activeOptions={waRailLinkActiveOptionsExact}
          >
            <MessageCircle className="size-5" />
          </WaRailLink>
        ) : (
          <WaRailLink
            to="/$organizacaoHash"
            params={{ organizacaoHash }}
            title="Conversas"
            activeOptions={waRailLinkActiveOptionsExact}
          >
            <MessageCircle className="size-5" />
          </WaRailLink>
        )}
        {instanciaInbox ? (
          <WaRailLink
            to="/$organizacaoHash/inbox/$instanceId/relatorios"
            params={{ organizacaoHash, instanceId: instanciaInbox.id }}
            title="Relatórios"
            activeOptions={waRailLinkActiveOptionsExact}
          >
            <ChartArea className="size-5" />
          </WaRailLink>
        ) : (
          <WaRailLink
            to="/$organizacaoHash/relatorios"
            params={{ organizacaoHash }}
            title="Relatórios"
            activeOptions={waRailLinkActiveOptionsExact}
          >
            <ChartArea className="size-5" />
          </WaRailLink>
        )}

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

        <RailButton icon={<Users className="size-5" />} disabled label="Comunidades" />
        <RailButton
          icon={
            <div className="size-5 rounded-full bg-gradient-to-br from-[oklch(0.7_0.2_300)] to-[oklch(0.6_0.2_260)]" />
          }
          disabled
          label="Canais"
        />
      </div>
      <div className="flex flex-col items-center gap-1">
        <WaRailTheme />
        <WaRailLink to="/$organizacaoHash/ajustes" params={{ organizacaoHash }} title="Ajustes">
          <Settings className="size-5" />
        </WaRailLink>
        <WaRailProfile />
      </div>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Sincronizar histórico?</AlertDialogTitle>
            <AlertDialogDescription>
              Vamos pedir o histórico do WhatsApp
              {instanciaEvo ? ` de “${instanciaEvo.nome}”` : ""} e processar em segundo plano. Pode
              levar alguns minutos.
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
              {sincronizar.isPending ? "Iniciando…" : "Sincronizar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </aside>
  );
}

function RailButton({
  icon,
  active,
  badge,
  disabled,
  label,
}: {
  icon: ReactNode;
  active?: boolean;
  badge?: string;
  disabled?: boolean;
  label?: string;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      aria-label={label}
      className={cn(
        "relative flex h-11 w-11 items-center justify-center rounded-lg transition-colors",
        active
          ? "bg-wa-chip-active text-wa-green-dark"
          : "text-wa-icon hover:bg-wa-hover disabled:cursor-not-allowed disabled:opacity-50",
      )}
    >
      {icon}
      {badge ? (
        <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-wa-badge px-1 text-[10px] font-bold text-white">
          {badge}
        </span>
      ) : null}
    </button>
  );
}
