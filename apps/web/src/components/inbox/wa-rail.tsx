import { useQuery } from "@tanstack/react-query";
import { getRouteApi, Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { isEvoProvider } from "@whasap/config";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@whasap/ui/components/sheet";
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
import { useCallback, useMemo, useState, type ReactNode } from "react";

import { WaMenuNavegacaoProvider } from "@/components/inbox/wa-menu-navegacao";
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

function useWaRailDados(organizacaoHash: string) {
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

  return {
    navigate,
    pathname,
    ajustes,
    instanciaInbox,
    instanciaEvo,
    campanhaHabilitada: org.data?.campanhaHabilitada === true,
    conversasAtivo: eRotaConversas(pathname, organizacaoHash),
  };
}

type WaRailConteudoProps = {
  organizacaoHash: string;
  onNavegar?: () => void;
};

/** Conteúdo da rail (ícones) — desktop. */
function WaRailDesktop({ organizacaoHash }: WaRailConteudoProps) {
  const { navigate, ajustes, instanciaInbox, instanciaEvo, campanhaHabilitada, conversasAtivo } =
    useWaRailDados(organizacaoHash);

  return (
    <>
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
    </>
  );
}

function sheetItemClass(ativo: boolean) {
  return cn(
    "flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
    ativo ? "bg-wa-chip-active text-wa-green-dark" : "text-wa-text hover:bg-wa-hover",
  );
}

/** Menu lateral com rótulos — mobile sheet. */
function WaRailSheetNav({ organizacaoHash, onNavegar }: WaRailConteudoProps) {
  const {
    navigate,
    pathname,
    ajustes,
    instanciaInbox,
    instanciaEvo,
    campanhaHabilitada,
    conversasAtivo,
  } = useWaRailDados(organizacaoHash);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <nav className="flex flex-col gap-0.5">
        {instanciaInbox ? (
          <Link
            to="/$organizacaoHash/inbox"
            params={{ organizacaoHash }}
            className={sheetItemClass(conversasAtivo)}
            onClick={onNavegar}
          >
            <MessageCircle className="size-5 shrink-0" />
            Conversas
          </Link>
        ) : (
          <Link
            to="/$organizacaoHash"
            params={{ organizacaoHash }}
            className={sheetItemClass(conversasAtivo)}
            onClick={onNavegar}
          >
            <MessageCircle className="size-5 shrink-0" />
            Conversas
          </Link>
        )}
        <Link
          to="/$organizacaoHash/respostas-rapidas"
          params={{ organizacaoHash }}
          className={sheetItemClass(pathname.includes("/respostas-rapidas"))}
          onClick={onNavegar}
        >
          <MessageSquareText className="size-5 shrink-0" />
          Respostas rápidas
        </Link>
        <Link
          to="/$organizacaoHash/relatorios"
          params={{ organizacaoHash }}
          className={sheetItemClass(pathname.includes("/relatorios"))}
          onClick={onNavegar}
        >
          <ChartArea className="size-5 shrink-0" />
          Relatórios
        </Link>
        <div className="px-1 py-1">
          <WaRailHistoricoSync organizacaoHash={organizacaoHash} instanciaEvo={instanciaEvo} />
        </div>
        <Link
          to="/$organizacaoHash/contatos"
          params={{ organizacaoHash }}
          className={sheetItemClass(pathname.includes("/contatos"))}
          onClick={onNavegar}
        >
          <Users className="size-5 shrink-0" />
          Contatos
        </Link>
        <Link
          to="/$organizacaoHash/acoes"
          params={{ organizacaoHash }}
          className={sheetItemClass(pathname.includes("/acoes"))}
          onClick={onNavegar}
        >
          <Zap className="size-5 shrink-0" />
          Ações
        </Link>
        {campanhaHabilitada ? (
          <Link
            to="/$organizacaoHash/campanha"
            params={{ organizacaoHash }}
            className={sheetItemClass(pathname.includes("/campanha"))}
            onClick={onNavegar}
          >
            <Megaphone className="size-5 shrink-0" />
            Campanha
          </Link>
        ) : null}
      </nav>

      <div className="mt-auto flex flex-col gap-0.5 border-t border-wa-divider pt-3">
        <div className="flex items-center gap-3 px-3 py-1">
          <WaRailTheme />
          <span className="text-sm text-wa-text-muted">Tema</span>
        </div>
        <button
          type="button"
          className={sheetItemClass(Boolean(ajustes))}
          onClick={() => {
            onNavegar?.();
            void navigate({
              to: ".",
              search: searchAbrirAjustes("geral"),
              replace: true,
            });
          }}
        >
          <Settings className="size-5 shrink-0" />
          Ajustes
        </button>
        <div className="flex items-center gap-3 px-3 py-1">
          <WaRailProfile />
          <span className="text-sm text-wa-text-muted">Perfil</span>
        </div>
      </div>
    </div>
  );
}

type WaRailShellProps = {
  organizacaoHash: string;
  children: ReactNode;
};

/**
 * Rail desktop + sheet mobile. Provider para o botão “abrir menu” na lista.
 */
export function WaRailShell({ organizacaoHash, children }: WaRailShellProps) {
  const [menuAberto, setMenuAberto] = useState(false);
  const abrir = useCallback(() => setMenuAberto(true), []);
  const menuValue = useMemo(() => ({ abrir }), [abrir]);

  return (
    <WaMenuNavegacaoProvider value={menuValue}>
      <aside className="hidden w-14 shrink-0 flex-col items-center justify-between border-r border-wa-divider bg-wa-sidebar py-3 md:flex">
        <WaRailDesktop organizacaoHash={organizacaoHash} />
      </aside>

      <Sheet open={menuAberto} onOpenChange={setMenuAberto}>
        <SheetContent
          side="left"
          className="flex w-[min(100%,18rem)] flex-col gap-0 bg-wa-sidebar p-4 text-wa-text"
        >
          <SheetHeader className="mb-4 text-left">
            <SheetTitle className="text-wa-text">Menu</SheetTitle>
          </SheetHeader>
          <WaRailSheetNav
            organizacaoHash={organizacaoHash}
            onNavegar={() => setMenuAberto(false)}
          />
        </SheetContent>
      </Sheet>

      {children}
    </WaMenuNavegacaoProvider>
  );
}

/** Rail só desktop. Preferir `WaRailShell` no shell da org. */
export function WaRail({ organizacaoHash }: { organizacaoHash: string }) {
  return (
    <aside className="hidden w-14 shrink-0 flex-col items-center justify-between border-r border-wa-divider bg-wa-sidebar py-3 md:flex">
      <WaRailDesktop organizacaoHash={organizacaoHash} />
    </aside>
  );
}
