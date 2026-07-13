import { useQuery } from "@tanstack/react-query";
import { isEvoProvider } from "@whasap/config";
import { cn } from "@whasap/ui/lib/utils";
import { ChartArea, MessageCircle, Settings, Users } from "lucide-react";
import type { ReactNode } from "react";

import { WaRailHistoricoSync } from "@/components/inbox/wa-rail-historico-sync";
import { WaRailLink, waRailLinkActiveOptionsExact } from "@/components/inbox/wa-rail-link";
import { WaRailProfile } from "@/components/inbox/wa-rail-profile";
import { WaRailTheme } from "@/components/inbox/wa-rail-theme";
import { historicoSyncEmAndamento } from "@/lib/historico-sync";
import { instanciaOperacional } from "@/lib/instancia-status";
import { orgInput } from "@/lib/org-input";
import { orpc } from "@/lib/orpc";

type WaRailProps = {
  organizacaoHash: string;
};

export function WaRail({ organizacaoHash }: WaRailProps) {
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
        isEvoProvider(i.provider) && (i.status === "connected" || i.status === "pending_payment"),
    ) ?? null;

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

        <WaRailHistoricoSync organizacaoHash={organizacaoHash} instanciaEvo={instanciaEvo} />

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
