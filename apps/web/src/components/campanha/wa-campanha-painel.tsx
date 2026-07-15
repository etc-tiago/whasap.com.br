import { cn } from "@whasap/ui/lib/utils";
import { X } from "lucide-react";

import {
  WaCampanhaForm,
  type InstanciaCampanha,
} from "@/components/campanha/wa-campanha-form";
import { WaIconButton } from "@/components/inbox/wa-icon-button";

type WaCampanhaPainelProps = {
  aberto: boolean;
  onFechar: () => void;
  organizacaoHash: string;
  instancias: InstanciaCampanha[];
  instanciaPadraoId?: string;
  nomeInicial?: string;
  telefoneInicial?: string;
  alertaConsecutivos?: number;
  onEnviado?: (conversaId: string) => void;
  className?: string;
};

/** Painel direito do inbox para envio imediato de campanha. */
export function WaCampanhaPainel({
  aberto,
  onFechar,
  organizacaoHash,
  instancias,
  instanciaPadraoId,
  nomeInicial,
  telefoneInicial,
  alertaConsecutivos,
  onEnviado,
  className,
}: WaCampanhaPainelProps) {
  if (!aberto) return null;

  return (
    <aside
      className={cn(
        "flex h-full w-80 shrink-0 flex-col border-l border-wa-divider bg-wa-panel",
        className,
      )}
    >
      <div className="flex items-center justify-between border-b border-wa-divider px-4 py-3">
        <h2 className="text-sm font-semibold text-wa-text">Campanha</h2>
        <WaIconButton label="Fechar painel" onClick={onFechar}>
          <X className="h-4 w-4" />
        </WaIconButton>
      </div>
      <div className="min-h-0 flex-1 overflow-auto p-4">
        <WaCampanhaForm
          organizacaoHash={organizacaoHash}
          instancias={instancias}
          instanciaPadraoId={instanciaPadraoId}
          nomeInicial={nomeInicial}
          telefoneInicial={telefoneInicial}
          alertaConsecutivos={alertaConsecutivos}
          compacto
          onEnviado={onEnviado}
        />
      </div>
    </aside>
  );
}
