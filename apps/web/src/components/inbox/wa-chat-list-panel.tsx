import {
  PanelSidebar,
  PanelSidebarActions,
  PanelSidebarContent,
  PanelSidebarHeader,
  PanelSidebarTitle,
} from "@whasap/ui/components/panel";
import { cn } from "@whasap/ui/lib/utils";
import { Archive, Menu, MessageSquarePlus, MoreVertical, Plus, Search } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";

import { WaIconButton } from "@/components/inbox/wa-icon-button";
import { useWaMenuNavegacao } from "@/components/inbox/wa-menu-navegacao";
import {
  WaNovaConversaPopover,
  type InstanciaNovaConversa,
} from "@/components/inbox/wa-nova-conversa-popover";

const FILTROS = ["Tudo", "Não lidas", "Favoritas", "Grupos"] as const;
export type FiltroConversa = (typeof FILTROS)[number];

const INSTANCIAS_VAZIAS: InstanciaNovaConversa[] = [];

type WaChatListPanelProps = {
  busca: string;
  onBuscaChange: (value: string) => void;
  filtroAtivo?: FiltroConversa;
  onFiltroChange?: (filtro: FiltroConversa) => void;
  /** Vista de conversas arquivadas (lista filtrada no servidor). */
  arquivadasAtivas?: boolean;
  onArquivadasChange?: (arquivadas: boolean) => void;
  children: ReactNode;
  instancias?: InstanciaNovaConversa[];
  instanciaPadraoId?: string;
  organizacaoHash?: string;
  podeIniciarConversa?: boolean;
  onConversaIniciada?: (conversaId: string) => void;
  /** Chamado após sucesso do iniciar, antes de navegar (ex.: limpar busca). */
  onAntesDeNavegarNovaConversa?: () => void;
  /** Telefone normalizado da busca sem match exato — exibe chip "Iniciar conversa". */
  telefoneIniciarBusca?: string | null;
  /** Abre o popover de nova conversa com telefone/mensagem/nome pré-preenchidos (deep-link). */
  iniciarConversaExterna?: {
    telefone: string;
    instanciaId?: string;
    mensagem?: string;
    nome?: string;
  } | null;
  onIniciarConversaExternaConsumida?: () => void;
};

type PrefillNovaConversa = {
  telefone?: string;
  mensagem?: string;
  nome?: string;
  instanciaId?: string;
};

export function WaChatListPanel({
  busca,
  onBuscaChange,
  filtroAtivo = "Tudo",
  onFiltroChange,
  arquivadasAtivas = false,
  onArquivadasChange,
  children,
  instancias = INSTANCIAS_VAZIAS,
  instanciaPadraoId,
  organizacaoHash,
  podeIniciarConversa,
  onConversaIniciada,
  onAntesDeNavegarNovaConversa,
  telefoneIniciarBusca,
  iniciarConversaExterna,
  onIniciarConversaExternaConsumida,
}: WaChatListPanelProps) {
  const [novaConversaOpen, setNovaConversaOpen] = useState(false);
  const [prefill, setPrefill] = useState<PrefillNovaConversa | null>(null);

  const podeAbrirNovaConversa =
    instancias.length > 0 &&
    Boolean(organizacaoHash && onConversaIniciada) &&
    Boolean(podeIniciarConversa);

  useEffect(() => {
    if (!iniciarConversaExterna?.telefone || !podeAbrirNovaConversa) return;
    setPrefill({
      telefone: iniciarConversaExterna.telefone,
      mensagem: iniciarConversaExterna.mensagem,
      nome: iniciarConversaExterna.nome,
      instanciaId: iniciarConversaExterna.instanciaId,
    });
    setNovaConversaOpen(true);
    onIniciarConversaExternaConsumida?.();
  }, [iniciarConversaExterna, podeAbrirNovaConversa, onIniciarConversaExternaConsumida]);

  function abrirNovaConversa(telefone?: string) {
    setPrefill(telefone ? { telefone } : null);
    setNovaConversaOpen(true);
  }

  function handleNovaConversaOpenChange(next: boolean) {
    setNovaConversaOpen(next);
    if (!next) setPrefill(null);
  }

  const instanciaPadraoEfetiva = prefill?.instanciaId ?? instanciaPadraoId;
  const menuNavegacao = useWaMenuNavegacao();

  return (
    <PanelSidebar className="border-wa-divider bg-wa-panel md:w-80 xl:w-96">
      <PanelSidebarHeader>
        <div className="flex min-w-0 items-center gap-1">
          {menuNavegacao ? (
            <WaIconButton
              label="Abrir menu"
              className="md:hidden"
              onClick={() => menuNavegacao.abrir()}
            >
              <Menu className="h-5 w-5" />
            </WaIconButton>
          ) : null}
          <PanelSidebarTitle className="text-wa-text">Mensagens</PanelSidebarTitle>
        </div>
        <PanelSidebarActions>
          {organizacaoHash && onConversaIniciada && instancias.length > 0 ? (
            <WaNovaConversaPopover
              organizacaoHash={organizacaoHash}
              instancias={instancias}
              instanciaPadraoId={instanciaPadraoEfetiva}
              disabled={!podeIniciarConversa}
              onConversaIniciada={onConversaIniciada}
              onAntesDeNavegar={onAntesDeNavegarNovaConversa}
              open={novaConversaOpen}
              onOpenChange={handleNovaConversaOpenChange}
              telefoneInicial={prefill?.telefone}
              mensagemInicial={prefill?.mensagem}
              nomeInicial={prefill?.nome}
            />
          ) : (
            <WaIconButton disabled label="Nova conversa">
              <MessageSquarePlus className="h-5 w-5" />
            </WaIconButton>
          )}
          <WaIconButton disabled label="Menu">
            <MoreVertical className="h-5 w-5" />
          </WaIconButton>
        </PanelSidebarActions>
      </PanelSidebarHeader>

      <PanelSidebarContent className="overflow-hidden">
        <div className="px-3 pb-2">
          <div className="flex items-center gap-2 rounded-full bg-wa-input px-3 py-2">
            <Search className="h-4 w-4 text-wa-icon" />
            <input
              value={busca}
              onChange={(e) => onBuscaChange(e.target.value)}
              placeholder="Pesquisar ou começar uma nova conversa"
              className="flex-1 bg-transparent text-sm text-wa-text placeholder:text-wa-text-muted focus:outline-none"
            />
          </div>
        </div>

        <div className="flex items-center gap-2 overflow-x-auto px-3 pb-2">
          {FILTROS.map((f) => {
            const desabilitado = f !== "Tudo" && f !== "Não lidas";
            return (
              <button
                key={f}
                type="button"
                disabled={desabilitado}
                onClick={() => !desabilitado && onFiltroChange?.(f)}
                className={cn(
                  "shrink-0 rounded-full px-3 py-1 text-xs font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50",
                  filtroAtivo === f
                    ? "bg-wa-chip-active text-wa-green-dark"
                    : "bg-wa-chip text-wa-text-muted hover:bg-wa-hover",
                )}
              >
                {f}
              </button>
            );
          })}
          {telefoneIniciarBusca && podeAbrirNovaConversa ? (
            <button
              type="button"
              onClick={() => abrirNovaConversa(telefoneIniciarBusca)}
              className="shrink-0 rounded-full bg-wa-chip-active px-3 py-1 text-xs font-medium text-wa-green-dark transition-colors hover:opacity-90"
            >
              Iniciar conversa
            </button>
          ) : null}
          <button
            type="button"
            disabled
            className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-wa-chip text-wa-text-muted disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Plus className="h-3.5 w-3.5" />
          </button>
        </div>

        <button
          type="button"
          onClick={() => onArquivadasChange?.(!arquivadasAtivas)}
          className={cn(
            "flex items-center gap-4 border-b border-wa-divider px-5 py-3 text-left hover:bg-wa-hover",
            arquivadasAtivas && "bg-wa-hover",
          )}
        >
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-wa-chip">
            <Archive className="h-4 w-4 text-wa-green-dark" />
          </div>
          <span className="text-sm font-medium text-wa-text">
            {arquivadasAtivas ? "Voltar às conversas" : "Arquivadas"}
          </span>
        </button>

        <div className="wa-scroll min-h-0 flex-1 overflow-y-auto">{children}</div>
      </PanelSidebarContent>
    </PanelSidebar>
  );
}
