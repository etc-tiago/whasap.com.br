import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@whasap/ui/components/tooltip";
import { useEffect, useState } from "react";

import { formatarCountdownJanela, tempoRestanteJanela } from "@/lib/inbox-utils";

type WaJanelaCloudCountdownProps = {
  expiraEm: string;
};

export function WaJanelaCloudCountdown({ expiraEm }: WaJanelaCloudCountdownProps) {
  const [agora, setAgora] = useState(() => new Date());

  useEffect(() => {
    const id = setInterval(() => setAgora(new Date()), 60_000);
    return () => clearInterval(id);
  }, []);

  const tempo = tempoRestanteJanela(expiraEm, agora);
  if (!tempo) return null;

  const expiraEmData = new Date(expiraEm).toLocaleString("pt-BR");

  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <p className="truncate text-xs text-wa-text-muted underline decoration-dotted underline-offset-2">
            {formatarCountdownJanela(tempo)}
          </p>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="max-w-xs text-center">
          <p>Janela de 24 horas da WhatsApp Cloud API.</p>
          <p className="mt-1 text-primary-foreground/80">
            Dentro deste prazo você pode enviar mensagens livres, sem template. Expira em{" "}
            {expiraEmData}.
          </p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
