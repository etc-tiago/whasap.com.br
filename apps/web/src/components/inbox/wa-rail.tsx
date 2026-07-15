import { useQuery } from "@tanstack/react-query";
import { getRouteApi, Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { isEvoProvider } from "@whasap/config";
import { cn } from "@whasap/ui/lib/utils";
import {
  ChartArea,
  Megaphone,
  MessageCircle,
  MessageSquareText,
  Settings,
  Users,
  Zap,
} from "lucide-react";

import { WaRailHistoricoSync } from "@/components/inbox/wa-rail-historico-sync";
import {
  WaRailLink,
  waRailLinkActiveOptionsExact,
  waRailLinkActiveProps,
  waRailLinkInactiveProps,
} from "@/components/inbox/wa-rail-link";
import { WaRailProfile } from "@/components/inbox/wa-rail-profile";
import { WaRailTheme } from "@/components/inbox/wa-rail-theme";
import { searchAbrirAjustes } from "@/lib/abrir-ajustes";
import { historicoSyncEmAndamento } from "@/lib/historico-sync";
import { instanciaOperacional } from "@/lib/instancia-status";
import { orgInput } from "@/lib/org-input";
import { orpc } from "@/lib/orpc";

const orgRouteApi = getRouteApi("/_panel/$organizacaoHash");

/** `/inbox` e `/chat/$conversaId` compartilham o destaque “Conversas”. */
function eRotaConversas(pathname: string, organizacaoHash: string): boolean {
  return (
    pathname.includes(`/${organizacaoHash}/inbox`) || pathname.includes(`/${organizacaoHash}/chat/`)
  );
}

type WaRailProps = {
  organizacaoHash: string;
};

export function WaRail({ organizacaoHash }: WaRailProps) {
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { ajustes } = orgRouteApi.useSearch();
  const instancias = useQuery({
    ...orpc.instancia.lista.queryOptions({ input: orgInput(organizacaoHash) }),
    refetchInterval: (q) => {
      const lista = q.state.data ?? [];
      return lista.some((i) => historicoSyncEmAndamento(i)) ? 5_000 : false;
    },
  });
  const org = useQuery(
    orpc.organizacao.obter.queryOptions({
      input: orgInput(organizacaoHash),
    }),
  );

  const instanciaInbox = instancias.data?.find((i) => instanciaOperacional(i.status));
  const instanciaEvo =
    instancias.data?.find(
      (i) =>
        isEvoProvider(i.provider) && (i.status === "connected" || i.status === "pending_payment"),
    ) ?? null;
  const campanhaHabilitada = org.data?.campanhaHabilitada === true;
  const conversasAtivo = eRotaConversas(pathname, organizacaoHash);

  return (
    <aside className="hidden w-14 shrink-0 flex-col items-center justify-between border-r border-wa-divider bg-wa-sidebar py-3 md:flex">
      <div className="flex flex-col items-center gap-1">
        {instanciaInbox ? (
          <Link
            to="/$organizacaoHash/inbox"
            params={{ organizacaoHash }}
            title="Conversas"
            className={
              conversasAtivo ? waRailLinkActiveProps.className : waRailLinkInactiveProps.className
            }
          >
            <MessageCircle className="size-5" />
          </Link>
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
          to="/$organizacaoHash/respostas-rapidas"
          params={{ organizacaoHash }}
          title="Respostas rápidas"
          activeOptions={waRailLinkActiveOptionsExact}
        >
          <MessageSquareText className="size-5" />
        </WaRailLink>
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

        {campanhaHabilitada ? (
          <WaRailLink to="/$organizacaoHash/campanha" params={{ organizacaoHash }} title="Campanha">
            <Megaphone className="size-5" />
          </WaRailLink>
        ) : null}
      </div>
      <div className="flex flex-col items-center gap-1">
        <WaRailTheme />
        <button
          type="button"
          title="Ajustes"
          className={cn(
            ajustes ? waRailLinkActiveProps.className : waRailLinkInactiveProps.className,
          )}
          onClick={() =>
            void navigate({
              to: ".",
              search: searchAbrirAjustes("geral"),
              replace: true,
            })
          }
        >
          <Settings className="size-5" />
        </button>
        <WaRailProfile />
      </div>
    </aside>
  );
}
