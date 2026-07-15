import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@whasap/ui/components/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@whasap/ui/components/dropdown-menu";
import { Check, CheckCheck, ChartNoAxesColumn, FileText, Info, Mic, Play, Reply } from "lucide-react";
import { useState, type ReactNode } from "react";

import {
  formatarDataHoraMensagem,
  formatarHorarioMensagem,
  formatarPreviewMensagem,
  isCorpoPlaceholderMidia,
  rotuloStatusEntrega,
} from "@/lib/inbox-utils";
import type { MensagemItem } from "@/lib/orpc";

type PollPayload = NonNullable<MensagemItem["poll"]>;

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

function AudioBlock({ mediaUrl }: { mediaUrl?: string | null }) {
  if (mediaUrl) {
    return (
      <audio controls preload="metadata" src={mediaUrl} className="max-w-full">
        <track kind="captions" />
      </audio>
    );
  }

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
      <button type="button" className="text-wa-icon" disabled aria-label="Áudio indisponível">
        <Play className="h-5 w-5 fill-current" />
      </button>
      <div className="flex w-40 items-center">
        <div className="relative h-0.5 flex-1 rounded-full bg-black/20" />
      </div>
      <span className="text-[11px] text-wa-text-muted">Áudio</span>
    </div>
  );
}

function MediaPendente({ tipo }: { tipo: string }) {
  const rotulo =
    tipo === "image"
      ? "Imagem"
      : tipo === "video"
        ? "Vídeo"
        : tipo === "audio"
          ? "Áudio"
          : tipo === "document"
            ? "Documento"
            : tipo === "sticker"
              ? "Figurinha"
              : "Mídia";
  return <p className="text-[13px] text-wa-text-muted">{rotulo} indisponível</p>;
}

function PollContent({ poll }: { poll: PollPayload }) {
  const nome = poll.name === "[enquete]" ? "Enquete" : poll.name;
  return (
    <div className="min-w-48 max-w-[18rem]">
      <div className="mb-1.5 flex items-center gap-1.5 text-[12px] font-medium text-wa-text-muted">
        <ChartNoAxesColumn className="h-3.5 w-3.5 shrink-0" />
        <span>Enquete</span>
      </div>
      <p className="mb-2 whitespace-pre-wrap wrap-break-word font-medium leading-snug">{nome}</p>
      {poll.options.length > 0 ? (
        <ul className="space-y-1.5">
          {poll.options.map((opcao, i) => (
            <li
              key={`${i}-${opcao}`}
              className="flex items-center gap-2 rounded-md border border-wa-border/60 bg-black/5 px-2.5 py-1.5 text-[13px] dark:bg-white/5"
            >
              <span
                className="h-3.5 w-3.5 shrink-0 rounded-full border border-wa-text-muted/50"
                aria-hidden
              />
              <span className="min-w-0 wrap-break-word">{opcao}</span>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

function MediaContent({ mensagem }: { mensagem: MensagemItem }) {
  const url = mensagem.mediaUrl;

  if (mensagem.type === "audio") {
    return <AudioBlock mediaUrl={url} />;
  }

  if (!url) {
    if (["image", "video", "document", "sticker"].includes(mensagem.type)) {
      return <MediaPendente tipo={mensagem.type} />;
    }
    return null;
  }

  if (mensagem.type === "image" || mensagem.type === "sticker") {
    return (
      <a href={url} target="_blank" rel="noreferrer">
        <img
          src={url}
          alt={mensagem.type === "sticker" ? "Figurinha" : "Imagem"}
          className="max-h-64 max-w-full rounded-md object-cover"
        />
      </a>
    );
  }

  if (mensagem.type === "video") {
    return (
      <video controls preload="metadata" src={url} className="max-h-64 max-w-full rounded-md">
        <track kind="captions" />
      </video>
    );
  }

  if (mensagem.type === "document") {
    const nome =
      mensagem.body && !isCorpoPlaceholderMidia(mensagem.body) ? mensagem.body : "Documento";
    return (
      <a
        href={url}
        target="_blank"
        rel="noreferrer"
        className="flex items-center gap-2 text-[13px] underline"
      >
        <FileText className="h-4 w-4 shrink-0" />
        <span className="min-w-0 truncate">{nome}</span>
      </a>
    );
  }

  return (
    <a href={url} target="_blank" rel="noreferrer" className="text-xs underline">
      Ver mídia
    </a>
  );
}

function corpoVisivel(mensagem: MensagemItem): string | null {
  if (mensagem.type === "poll" && mensagem.poll) return null;
  const corpo = mensagem.body?.trim();
  if (!corpo) return null;
  if (isCorpoPlaceholderMidia(corpo)) return null;
  if (mensagem.type === "document" && mensagem.mediaUrl) return null;
  return corpo;
}

function BubbleBody({
  mensagem,
  footer,
  alignEnd,
  podeResponder,
  onResponder,
}: {
  mensagem: MensagemItem;
  footer: ReactNode;
  alignEnd?: boolean;
  podeResponder?: boolean;
  onResponder?: (mensagem: MensagemItem) => void;
}) {
  const isAudio = mensagem.type === "audio";
  const texto = corpoVisivel(mensagem);
  const menu = (
    <BubbleMenu mensagem={mensagem} podeResponder={podeResponder} onResponder={onResponder} />
  );

  if (isAudio) {
    return (
      <>
        <AudioBlock mediaUrl={mensagem.mediaUrl} />
        <div className="mt-0.5 flex items-center justify-end gap-1.5 text-[11px] text-wa-text-muted">
          {menu}
          {footer}
        </div>
      </>
    );
  }

  return (
    <div className={`flex flex-wrap items-end gap-x-2${alignEnd ? " justify-end" : ""}`}>
      <div className="min-w-0 pl-1 text-[14.2px] text-wa-text">
        {mensagem.type === "poll" && mensagem.poll ? (
          <PollContent poll={mensagem.poll} />
        ) : (
          <>
            <MediaContent mensagem={mensagem} />
            {texto ? <p className="whitespace-pre-wrap wrap-break-word">{texto}</p> : null}
          </>
        )}
        {mensagem.enviadoPorNome ? (
          <p className="mt-0.5 text-[10px] opacity-70">{mensagem.enviadoPorNome}</p>
        ) : null}
        {mensagem.templateNome ? (
          <p className="mt-0.5 text-[10px] opacity-70">Template: {mensagem.templateNome}</p>
        ) : null}
      </div>
      <div className="ml-auto flex shrink-0 items-center justify-end gap-1.5 pt-1 text-[11px] text-wa-text-muted">
        {menu}
        <span className="flex items-center gap-1">{footer}</span>
      </div>
    </div>
  );
}

function DetalheLinha({ rotulo, valor }: { rotulo: string; valor: string }) {
  return (
    <div className="grid grid-cols-[7.5rem_1fr] gap-x-3 gap-y-1 text-sm">
      <dt className="text-muted-foreground">{rotulo}</dt>
      <dd className="min-w-0 break-all text-foreground">{valor}</dd>
    </div>
  );
}

function MensagemDetalhesDialog({
  mensagem,
  open,
  onOpenChange,
}: {
  mensagem: MensagemItem;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Detalhes da mensagem</DialogTitle>
        </DialogHeader>
        <dl className="space-y-3">
          <DetalheLinha rotulo="Data/hora" valor={formatarDataHoraMensagem(mensagem.enviadoEm)} />
          <DetalheLinha
            rotulo="Registrado em"
            valor={formatarDataHoraMensagem(mensagem.criadoEm)}
          />
          <DetalheLinha rotulo="Status" valor={rotuloStatusEntrega(mensagem.statusEntrega)} />
          <DetalheLinha
            rotulo="Direção"
            valor={mensagem.direction === "outbound" ? "Enviada" : "Recebida"}
          />
          <DetalheLinha rotulo="Tipo" valor={mensagem.type} />
          {mensagem.enviadoPorNome ? (
            <DetalheLinha rotulo="Enviado por" valor={mensagem.enviadoPorNome} />
          ) : null}
          {mensagem.templateNome ? (
            <DetalheLinha rotulo="Template" valor={mensagem.templateNome} />
          ) : null}
          {mensagem.type === "poll" && mensagem.poll ? (
            <>
              <DetalheLinha
                rotulo="Pergunta"
                valor={
                  mensagem.poll.name === "[enquete]" ? "Enquete" : mensagem.poll.name
                }
              />
              <DetalheLinha
                rotulo="Opções"
                valor={
                  mensagem.poll.options.length > 0
                    ? mensagem.poll.options.join(", ")
                    : "—"
                }
              />
            </>
          ) : (
            <DetalheLinha
              rotulo="Conteúdo"
              valor={formatarPreviewMensagem(mensagem.body, mensagem.type) || "—"}
            />
          )}
          <DetalheLinha rotulo="ID" valor={mensagem.id} />
        </dl>
      </DialogContent>
    </Dialog>
  );
}

type BubbleAcoesProps = {
  mensagem: MensagemItem;
  podeResponder?: boolean;
  onResponder?: (mensagem: MensagemItem) => void;
};

function BubbleMenu({ mensagem, podeResponder = true, onResponder }: BubbleAcoesProps) {
  const [detalhesAberto, setDetalhesAberto] = useState(false);
  const podeCitar = Boolean(mensagem.idExterno) && podeResponder && Boolean(onResponder);

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            aria-label="Opções da mensagem"
            className="flex shrink-0 items-center justify-center rounded text-wa-text-muted opacity-60 transition-opacity hover:opacity-100 data-[state=open]:opacity-100"
          >
            <Info className="size-2.5" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" side="top" className="w-44">
          <DropdownMenuItem disabled={!podeCitar} onSelect={() => onResponder?.(mensagem)}>
            <Reply />
            Responder
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => setDetalhesAberto(true)}>
            <Info />
            Ver detalhes
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <MensagemDetalhesDialog
        mensagem={mensagem}
        open={detalhesAberto}
        onOpenChange={setDetalhesAberto}
      />
    </>
  );
}

type BubbleProps = {
  mensagem: MensagemItem;
  podeResponder?: boolean;
  onResponder?: (mensagem: MensagemItem) => void;
};

export function WaBubbleOut({ mensagem, podeResponder, onResponder }: BubbleProps) {
  const time = formatarHorarioMensagem(mensagem.enviadoEm);

  return (
    <div className="mb-1 flex justify-end">
      <div className="relative max-w-[65%] rounded-lg rounded-tr-none bg-wa-bubble-out px-2 py-1.5 shadow-sm">
        <BubbleBody
          mensagem={mensagem}
          alignEnd
          podeResponder={podeResponder}
          onResponder={onResponder}
          footer={
            <>
              {time}
              <StatusTick status={mensagem.statusEntrega} />
            </>
          }
        />
      </div>
    </div>
  );
}

export function WaBubbleIn({ mensagem, podeResponder, onResponder }: BubbleProps) {
  const time = formatarHorarioMensagem(mensagem.enviadoEm);

  return (
    <div className="mb-1 flex justify-start">
      <div className="relative max-w-[65%] rounded-lg rounded-tl-none bg-wa-bubble-in px-2 py-1.5 shadow-sm">
        <BubbleBody
          mensagem={mensagem}
          podeResponder={podeResponder}
          onResponder={onResponder}
          footer={time}
        />
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
