import { Send } from "lucide-react";
import type { ReactNode } from "react";
import { Panel, PanelMain } from "@whasap/ui/components/panel";

import { WaChatListPanel, type FiltroConversa } from "@/components/inbox/wa-chat-list-panel";
import type { InstanciaNovaConversa } from "@/components/inbox/wa-nova-conversa-popover";
import { WaEmptyChat } from "@/components/inbox/wa-message-bubble";

type WaShellProps = {
  busca: string;
  onBuscaChange: (value: string) => void;
  filtroAtivo?: FiltroConversa;
  onFiltroChange?: (filtro: FiltroConversa) => void;
  listaConversas: ReactNode;
  conversaAberta: boolean;
  instancias?: InstanciaNovaConversa[];
  instanciaPadraoId?: string;
  organizacaoHash?: string;
  podeIniciarConversa?: boolean;
  onConversaIniciada?: (conversaId: string) => void;
  onAntesDeNavegarNovaConversa?: () => void;
  telefoneIniciarBusca?: string | null;
  iniciarConversaExterna?: { telefone: string; instanciaId?: string } | null;
  onIniciarConversaExternaConsumida?: () => void;
  chatHeader?: ReactNode;
  chatBody?: ReactNode;
  composer?: ReactNode;
  /** Painel direito (ex.: campanha). */
  painelDireito?: ReactNode;
};

export function WaShell({
  busca,
  onBuscaChange,
  filtroAtivo,
  onFiltroChange,
  listaConversas,
  conversaAberta,
  instancias,
  instanciaPadraoId,
  organizacaoHash,
  podeIniciarConversa,
  onConversaIniciada,
  onAntesDeNavegarNovaConversa,
  telefoneIniciarBusca,
  iniciarConversaExterna,
  onIniciarConversaExternaConsumida,
  chatHeader,
  chatBody,
  composer,
  painelDireito,
}: WaShellProps) {
  return (
    <div className="flex h-full min-h-0 w-full overflow-hidden">
      <Panel activePane={conversaAberta ? "main" : "sidebar"} className="min-w-0 flex-1">
        <WaChatListPanel
          busca={busca}
          onBuscaChange={onBuscaChange}
          filtroAtivo={filtroAtivo}
          onFiltroChange={onFiltroChange}
          instancias={instancias}
          instanciaPadraoId={iniciarConversaExterna?.instanciaId ?? instanciaPadraoId}
          organizacaoHash={organizacaoHash}
          podeIniciarConversa={podeIniciarConversa}
          onConversaIniciada={onConversaIniciada}
          onAntesDeNavegarNovaConversa={onAntesDeNavegarNovaConversa}
          telefoneIniciarBusca={telefoneIniciarBusca}
          iniciarConversaExterna={iniciarConversaExterna}
          onIniciarConversaExternaConsumida={onIniciarConversaExternaConsumida}
        >
          {listaConversas}
        </WaChatListPanel>

        <PanelMain className="relative min-h-0 overflow-hidden bg-wa-chat-bg">
          <div aria-hidden className="pointer-events-none absolute inset-0 wa-wallpaper" />
          {conversaAberta ? (
            <>
              {chatHeader}
              {chatBody}
              {composer}
            </>
          ) : (
            <WaEmptyChat>
              <div className="mb-4 rounded-full bg-wa-panel p-6 shadow-sm">
                <Send className="h-10 w-10 text-wa-text-muted" />
              </div>
              <h2 className="text-lg font-medium text-wa-text">Whasap Web</h2>
              <p className="mt-2 max-w-sm text-sm text-wa-text-muted">
                Envie e receba mensagens sem manter seu celular conectado à internet.
              </p>
              <p className="mt-4 max-w-sm text-xs text-wa-text-muted">
                Selecione uma conversa à esquerda para começar.
              </p>
            </WaEmptyChat>
          )}
        </PanelMain>
      </Panel>

      {painelDireito}
    </div>
  );
}
