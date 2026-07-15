import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@whasap/ui/components/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@whasap/ui/components/dropdown-menu";
import { cn } from "@whasap/ui/lib/utils";
import { Check, CheckCheck, ChevronDown, FileText, Info, Mic, Play, Reply } from "lucide-react";
import { useState, type ReactNode } from "react";

import {
  formatarDataHoraMensagem,
  formatarHorarioMensagem,
  formatarPreviewMensagem,
  isCorpoPlaceholderMidia,
  rotuloStatusEntrega,
} from "@/lib/inbox-utils";
import type { MensagemItem } from "@/lib/orpc";

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
}: {
  mensagem: MensagemItem;
  footer: ReactNode;
  alignEnd?: boolean;
}) {
  const isAudio = mensagem.type === "audio";
  const texto = corpoVisivel(mensagem);

  if (isAudio) {
    return (
      <>
        <AudioBlock mediaUrl={mensagem.mediaUrl} />
        <div className="mt-0.5 flex justify-end gap-1 text-[11px] text-wa-text-muted">{footer}</div>
      </>
    );
  }

  return (
    <div className={`flex flex-wrap items-end gap-x-2${alignEnd ? " justify-end" : ""}`}>
      <div className="min-w-0 pl-1 text-[14.2px] text-wa-text">
        <MediaContent mensagem={mensagem} />
        {texto ? <p className="whitespace-pre-wrap wrap-break-word">{texto}</p> : null}
        {mensagem.enviadoPorNome ? (
          <p className="mt-0.5 text-[10px] opacity-70">{mensagem.enviadoPorNome}</p>
        ) : null}
        {mensagem.templateNome ? (
          <p className="mt-0.5 text-[10px] opacity-70">Template: {mensagem.templateNome}</p>
        ) : null}
      </div>
      <span className="ml-auto flex shrink-0 items-center gap-1 pt-1 text-[11px] text-wa-text-muted">
        {footer}
      </span>
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
          <DetalheLinha rotulo="Data/hora" valor={formatarDataHoraMensagem(mensagem.criadoEm)} />
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
          <DetalheLinha
            rotulo="Conteúdo"
            valor={formatarPreviewMensagem(mensagem.body, mensagem.type) || "—"}
          />
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
  align: "start" | "end";
};

function BubbleMenu({ mensagem, podeResponder = true, onResponder, align }: BubbleAcoesProps) {
  const [detalhesAberto, setDetalhesAberto] = useState(false);
  const podeCitar = Boolean(mensagem.idExterno) && podeResponder && Boolean(onResponder);

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            aria-label="Opções da mensagem"
            className={cn(
              "absolute top-0.5 z-10 flex h-6 w-6 items-center justify-center rounded-md text-wa-text-muted opacity-0 transition-opacity hover:bg-black/10 group-hover:opacity-100 data-[state=open]:bg-black/10 data-[state=open]:opacity-100",
              align === "end" ? "left-0.5" : "right-0.5",
            )}
          >
            <ChevronDown className="h-4 w-4" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align={align === "end" ? "end" : "start"}
          side="bottom"
          className="w-44"
        >
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
  const time = formatarHorarioMensagem(mensagem.criadoEm);

  return (
    <div className="group mb-1 flex justify-end">
      <div className="relative max-w-[65%] rounded-lg rounded-tr-none bg-wa-bubble-out px-2 py-1.5 shadow-sm">
        <BubbleMenu
          mensagem={mensagem}
          podeResponder={podeResponder}
          onResponder={onResponder}
          align="end"
        />
        <BubbleBody
          mensagem={mensagem}
          alignEnd
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
  const time = formatarHorarioMensagem(mensagem.criadoEm);

  return (
    <div className="group mb-1 flex justify-start">
      <div className="relative max-w-[65%] rounded-lg rounded-tl-none bg-wa-bubble-in px-2 py-1.5 shadow-sm">
        <BubbleMenu
          mensagem={mensagem}
          podeResponder={podeResponder}
          onResponder={onResponder}
          align="start"
        />
        <BubbleBody mensagem={mensagem} footer={time} />
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
