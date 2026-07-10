import { Archive, MessageSquarePlus, MoreVertical, Plus, Search } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@whasap/ui/lib/utils";

import { WaIconButton } from "@/components/inbox/wa-icon-button";
import { WaNovaConversaPopover } from "@/components/inbox/wa-nova-conversa-popover";

const FILTROS = ["Tudo", "Não lidas", "Favoritas", "Grupos"] as const;
export type FiltroConversa = (typeof FILTROS)[number];

type WaChatListPanelProps = {
  busca: string;
  onBuscaChange: (value: string) => void;
  filtroAtivo?: FiltroConversa;
  onFiltroChange?: (filtro: FiltroConversa) => void;
  children: ReactNode;
  mobileHidden?: boolean;
  instanciaId?: string;
  organizacaoHash?: string;
  provedor?: string;
  podeIniciarConversa?: boolean;
  onConversaIniciada?: (conversaId: string) => void;
};

export function WaChatListPanel({
  busca,
  onBuscaChange,
  filtroAtivo = "Tudo",
  onFiltroChange,
  children,
  mobileHidden,
  instanciaId,
  organizacaoHash,
  provedor,
  podeIniciarConversa,
  onConversaIniciada,
}: WaChatListPanelProps) {
  return (
    <section
      className={cn(
        "flex w-full flex-col border-r border-wa-divider bg-wa-panel md:w-80 xl:w-96",
        mobileHidden ? "hidden md:flex" : "flex",
      )}
    >
      <div className="flex items-center justify-between px-5 pb-2 pt-4">
        <h1 className="text-2xl font-semibold text-wa-text">Whasap</h1>
        <div className="flex items-center gap-1">
          {instanciaId && organizacaoHash && provedor && onConversaIniciada ? (
            <WaNovaConversaPopover
              organizacaoHash={organizacaoHash}
              instanciaId={instanciaId}
              provedor={provedor}
              disabled={!podeIniciarConversa}
              onConversaIniciada={onConversaIniciada}
            />
          ) : (
            <WaIconButton disabled label="Nova conversa">
              <MessageSquarePlus className="h-5 w-5" />
            </WaIconButton>
          )}
          <WaIconButton disabled label="Menu">
            <MoreVertical className="h-5 w-5" />
          </WaIconButton>
        </div>
      </div>

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
        disabled
        className="flex items-center gap-4 border-b border-wa-divider px-5 py-3 text-left hover:bg-wa-hover disabled:cursor-not-allowed disabled:opacity-50"
      >
        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-wa-chip">
          <Archive className="h-4 w-4 text-wa-green-dark" />
        </div>
        <span className="text-sm font-medium text-wa-text">Arquivadas</span>
      </button>

      <div className="wa-scroll min-h-0 flex-1 overflow-y-auto">{children}</div>
    </section>
  );
}
