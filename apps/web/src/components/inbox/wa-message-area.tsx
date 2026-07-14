import { Lock, Loader2 } from "lucide-react";
import { useEffect, useLayoutEffect, useRef } from "react";

import { WaBubbleIn, WaBubbleOut, WaDayLabel } from "@/components/inbox/wa-message-bubble";
import { agruparMensagensPorDia } from "@/lib/inbox-utils";
import type { MensagemItem } from "@/lib/orpc";

const LIMIAR_TOPO_PX = 80;
const LIMIAR_RODAPE_PX = 80;

type WaMessageAreaProps = {
  conversaId: string;
  mensagens: MensagemItem[];
  temMaisAntigas: boolean;
  isFetchingNextPage: boolean;
  onNearTop: () => void;
  /** Incrementa ao enviar — força scroll no rodapé. */
  forcarRodapeToken?: number;
};

export function WaMessageArea({
  conversaId,
  mensagens,
  temMaisAntigas,
  isFetchingNextPage,
  onNearTop,
  forcarRodapeToken = 0,
}: WaMessageAreaProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const pertoDoRodapeRef = useRef(true);
  const scrollHeightAntesPrependRef = useRef<number | null>(null);
  const conversaAnteriorRef = useRef<string | null>(null);
  const mensagensLenAnteriorRef = useRef(0);
  const buscandoTopoRef = useRef(false);

  const grupos = agruparMensagensPorDia(mensagens);

  function scrollToBottom(behavior: ScrollBehavior = "auto") {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior });
    pertoDoRodapeRef.current = true;
  }

  function atualizarPertoDoRodape() {
    const el = scrollRef.current;
    if (!el) return;
    pertoDoRodapeRef.current =
      el.scrollHeight - el.scrollTop - el.clientHeight < LIMIAR_RODAPE_PX;
  }

  useEffect(() => {
    conversaAnteriorRef.current = null;
    mensagensLenAnteriorRef.current = 0;
    pertoDoRodapeRef.current = true;
    scrollHeightAntesPrependRef.current = null;
    buscandoTopoRef.current = false;
  }, [conversaId]);

  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (!el) return;

    const trocouConversa = conversaAnteriorRef.current !== conversaId;
    if (trocouConversa) {
      conversaAnteriorRef.current = conversaId;
      mensagensLenAnteriorRef.current = mensagens.length;
      if (mensagens.length > 0) scrollToBottom();
      return;
    }

    const heightAntes = scrollHeightAntesPrependRef.current;
    if (heightAntes != null) {
      if (mensagens.length > mensagensLenAnteriorRef.current) {
        el.scrollTop += el.scrollHeight - heightAntes;
      }
      scrollHeightAntesPrependRef.current = null;
      buscandoTopoRef.current = false;
      mensagensLenAnteriorRef.current = mensagens.length;
      return;
    }

    if (pertoDoRodapeRef.current && mensagens.length > 0) {
      scrollToBottom();
    }

    mensagensLenAnteriorRef.current = mensagens.length;
  }, [conversaId, mensagens]);

  useEffect(() => {
    if (forcarRodapeToken > 0) scrollToBottom("smooth");
  }, [forcarRodapeToken]);

  useEffect(() => {
    if (isFetchingNextPage) {
      const el = scrollRef.current;
      if (el && scrollHeightAntesPrependRef.current == null) {
        scrollHeightAntesPrependRef.current = el.scrollHeight;
      }
      return;
    }
    buscandoTopoRef.current = false;
  }, [isFetchingNextPage]);

  function handleScroll() {
    const el = scrollRef.current;
    if (!el) return;
    atualizarPertoDoRodape();

    if (
      el.scrollTop < LIMIAR_TOPO_PX &&
      temMaisAntigas &&
      !isFetchingNextPage &&
      !buscandoTopoRef.current
    ) {
      buscandoTopoRef.current = true;
      scrollHeightAntesPrependRef.current = el.scrollHeight;
      onNearTop();
    }
  }

  return (
    <div
      ref={scrollRef}
      onScroll={handleScroll}
      className="wa-scroll min-h-0 flex-1 overflow-y-auto px-[8%] py-4"
    >
      {temMaisAntigas || isFetchingNextPage ? (
        <div className="mb-3 flex justify-center">
          {isFetchingNextPage ? (
            <Loader2
              className="h-4 w-4 animate-spin text-wa-icon"
              aria-label="Carregando mensagens"
            />
          ) : (
            <span className="h-4" aria-hidden />
          )}
        </div>
      ) : null}
      <div className="mb-3 flex justify-center">
        <div className="rounded-lg bg-wa-chip px-3 py-1 text-xs text-wa-text-muted shadow-sm">
          <Lock className="mr-1 inline h-3 w-3" />
          As mensagens e as chamadas são protegidas com a criptografia de ponta a ponta.
        </div>
      </div>
      {grupos.map((grupo) => (
        <div key={grupo.dia}>
          <WaDayLabel time={grupo.dia} />
          {grupo.mensagens.map((m) =>
            m.direction === "outbound" ? (
              <WaBubbleOut key={m.id} mensagem={m} />
            ) : (
              <WaBubbleIn key={m.id} mensagem={m} />
            ),
          )}
        </div>
      ))}
      {mensagens.length === 0 ? (
        <p className="text-center text-sm text-wa-text-muted">
          Nenhuma mensagem nesta conversa ainda.
        </p>
      ) : null}
    </div>
  );
}
