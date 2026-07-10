import { Send } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@whasap/ui/lib/utils";

import { WaChatListPanel } from "@/components/inbox/wa-chat-list-panel";
import { WaEmptyChat } from "@/components/inbox/wa-message-bubble";

type WaShellProps = {
  busca: string;
  onBuscaChange: (value: string) => void;
  listaConversas: ReactNode;
  conversaAberta: boolean;
  instanciaId?: string;
  provedor?: string;
  podeIniciarConversa?: boolean;
  onConversaIniciada?: (conversaId: string) => void;
  chatHeader?: ReactNode;
  chatBody?: ReactNode;
  composer?: ReactNode;
};

export function WaShell({
  busca,
  onBuscaChange,
  listaConversas,
  conversaAberta,
  instanciaId,
  provedor,
  podeIniciarConversa,
  onConversaIniciada,
  chatHeader,
  chatBody,
  composer,
}: WaShellProps) {
  return (
    <div className="flex h-full min-h-0 w-full overflow-hidden">
      <WaChatListPanel
        busca={busca}
        onBuscaChange={onBuscaChange}
        mobileHidden={conversaAberta}
        instanciaId={instanciaId}
        provedor={provedor}
        podeIniciarConversa={podeIniciarConversa}
        onConversaIniciada={onConversaIniciada}
      >
        {listaConversas}
      </WaChatListPanel>

      <section
        className={cn(
          "min-w-0 flex-1 flex-col wa-wallpaper",
          conversaAberta ? "flex" : "hidden md:flex",
        )}
      >
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
      </section>
    </div>
  );
}
