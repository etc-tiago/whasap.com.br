import { Check, CheckCheck, Mic, Play } from "lucide-react";
import type { ReactNode } from "react";

import type { MensagemItem } from "@/lib/orpc";
import { formatarHorarioMensagem } from "@/lib/inbox-utils";

function StatusTick({ status }: { status: string }) {
  const lido = status === "read" || status === "played";
  const entregue = lido || status === "delivered" || status === "sent";

  if (lido) {
    return <CheckCheck className="h-3.5 w-3.5 text-wa-tick" />;
  }
  if (entregue) {
    return <CheckCheck className="h-3.5 w-3.5 text-wa-text-muted" />;
  }
  return <Check className="h-3.5 w-3.5 text-wa-text-muted" />;
}

function AudioBlock() {
  return (
    <div className="flex items-center gap-3 py-1">
      <div
        className="relative h-10 w-10 rounded-full"
        style={{
          backgroundColor: "oklch(0.55 0.05 50)",
          backgroundImage:
            "radial-gradient(circle at 50% 35%, oklch(0.75 0.05 50), oklch(0.4 0.04 40))",
        }}
      >
        <Mic className="absolute -bottom-0.5 -right-0.5 h-4 w-4 rounded-full bg-wa-green p-0.5 text-white" />
      </div>
      <button type="button" className="text-wa-icon" disabled aria-label="Reproduzir áudio">
        <Play className="h-5 w-5 fill-current" />
      </button>
      <div className="flex w-40 items-center">
        <div className="relative h-0.5 flex-1 rounded-full bg-black/20">
          <div className="absolute inset-y-0 left-0 w-1/3 rounded-full bg-wa-tick" />
          <div className="absolute left-1/3 top-1/2 h-2.5 w-2.5 -translate-y-1/2 rounded-full bg-wa-tick" />
        </div>
      </div>
      <span className="text-[11px] text-wa-text-muted">0:00</span>
    </div>
  );
}

function MediaContent({ mensagem }: { mensagem: MensagemItem }) {
  if (mensagem.type === "audio") {
    return <AudioBlock />;
  }
  if (mensagem.mediaUrl) {
    if (mensagem.type === "image") {
      return (
        <a href={mensagem.mediaUrl} target="_blank" rel="noreferrer">
          <img
            src={mensagem.mediaUrl}
            alt="Mídia"
            className="max-h-64 max-w-full rounded-md object-cover"
          />
        </a>
      );
    }
    return (
      <a
        href={mensagem.mediaUrl}
        target="_blank"
        rel="noreferrer"
        className="text-xs underline"
      >
        Ver {mensagem.type}
      </a>
    );
  }
  return null;
}

export function WaBubbleOut({ mensagem }: { mensagem: MensagemItem }) {
  const time = formatarHorarioMensagem(mensagem.criadoEm);
  const isAudio = mensagem.type === "audio";

  return (
    <div className="mb-1 flex justify-end">
      <div className="relative max-w-[65%] rounded-lg rounded-tr-none bg-wa-bubble-out px-2 py-1.5 shadow-sm">
        {isAudio ? (
          <AudioBlock />
        ) : (
          <div className="flex flex-wrap items-end justify-end gap-x-2">
            <div className="min-w-0 pl-1 text-[14.2px] text-wa-text">
              <MediaContent mensagem={mensagem} />
              {mensagem.body ? (
                <p className="whitespace-pre-wrap wrap-break-word">{mensagem.body}</p>
              ) : null}
              {mensagem.enviadoPorNome ? (
                <p className="mt-0.5 text-[10px] opacity-70">{mensagem.enviadoPorNome}</p>
              ) : null}
              {mensagem.templateNome ? (
                <p className="mt-0.5 text-[10px] opacity-70">Template: {mensagem.templateNome}</p>
              ) : null}
            </div>
            <span className="ml-auto flex shrink-0 items-center gap-1 pt-1 text-[11px] text-wa-text-muted">
              {time}
              <StatusTick status={mensagem.statusEntrega} />
            </span>
          </div>
        )}
        {isAudio ? (
          <div className="mt-0.5 flex justify-end gap-1 text-[11px] text-wa-text-muted">
            {time}
            <StatusTick status={mensagem.statusEntrega} />
          </div>
        ) : null}
      </div>
    </div>
  );
}

export function WaBubbleIn({ mensagem }: { mensagem: MensagemItem }) {
  const time = formatarHorarioMensagem(mensagem.criadoEm);
  const isAudio = mensagem.type === "audio";

  return (
    <div className="mb-1 flex justify-start">
      <div className="relative max-w-[65%] rounded-lg rounded-tl-none bg-wa-bubble-in px-2 py-1.5 shadow-sm">
        {isAudio ? (
          <AudioBlock />
        ) : (
          <div className="flex flex-wrap items-end gap-x-2">
            <div className="min-w-0 pl-1 text-[14.2px] text-wa-text">
              <MediaContent mensagem={mensagem} />
              {mensagem.body ? (
                <p className="whitespace-pre-wrap wrap-break-word">{mensagem.body}</p>
              ) : null}
              {mensagem.templateNome ? (
                <p className="mt-0.5 text-[10px] opacity-70">Template: {mensagem.templateNome}</p>
              ) : null}
            </div>
            <span className="ml-auto flex shrink-0 items-center gap-1 pt-1 text-[11px] text-wa-text-muted">
              {time}
            </span>
          </div>
        )}
        {isAudio ? (
          <div className="mt-0.5 flex justify-end text-[11px] text-wa-text-muted">{time}</div>
        ) : null}
      </div>
    </div>
  );
}

export function WaDayLabel({ time }: { time: string }) {
  return (
    <div className="my-3 flex justify-center">
      <div className="rounded-lg bg-wa-chip px-3 py-1 text-xs font-medium text-wa-text-muted shadow-sm">
        {time}
      </div>
    </div>
  );
}


export function WaEmptyChat({ children }: { children?: ReactNode }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center px-6 text-center">
      {children}
    </div>
  );
}
