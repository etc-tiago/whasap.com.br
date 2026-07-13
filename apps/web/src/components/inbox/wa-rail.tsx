import { useQuery } from "@tanstack/react-query";
import { isEvoProvider } from "@whasap/config";
import { ChartArea, MessageCircle, Settings, Users, Zap } from "lucide-react";

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
        <WaRailLink
          to="/$organizacaoHash/relatorios"
          params={{ organizacaoHash }}
          title="Relatórios"
          activeOptions={waRailLinkActiveOptionsExact}
        >
          <ChartArea className="size-5" />
        </WaRailLink>

        <WaRailHistoricoSync organizacaoHash={organizacaoHash} instanciaEvo={instanciaEvo} />

        <WaRailLink
          to="/$organizacaoHash/contatos"
          params={{ organizacaoHash }}
          title="Contatos"
          activeOptions={waRailLinkActiveOptionsExact}
        >
          <Users className="size-5" />
        </WaRailLink>

        <WaRailLink to="/$organizacaoHash/acoes" params={{ organizacaoHash }} title="Ações">
          <Zap className="size-5" />
        </WaRailLink>
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
