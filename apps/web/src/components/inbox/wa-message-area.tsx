import { Lock } from "lucide-react";

import { WaBubbleIn, WaBubbleOut, WaDayLabel } from "@/components/inbox/wa-message-bubble";
import { agruparMensagensPorDia } from "@/lib/inbox-utils";
import type { MensagemItem } from "@/lib/orpc";

type WaMessageAreaProps = {
  mensagens: MensagemItem[];
};

export function WaMessageArea({ mensagens }: WaMessageAreaProps) {
  const grupos = agruparMensagensPorDia(mensagens);

  return (
    <div className="wa-scroll min-h-0 flex-1 overflow-y-auto px-[8%] py-4">
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
