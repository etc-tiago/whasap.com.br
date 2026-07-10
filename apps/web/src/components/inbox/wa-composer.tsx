import { Input } from "@whasap/ui/components/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@whasap/ui/components/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@whasap/ui/components/select";
import { Mic, Plus, Send, Sticker } from "lucide-react";
import { useState } from "react";

import { WaIconButton } from "@/components/inbox/wa-icon-button";

type TipoMensagem = "text" | "image" | "audio" | "video" | "document";

type WaComposerProps = {
  message: string;
  tipoMensagem: TipoMensagem;
  mediaUrl: string;
  disabled?: boolean;
  pending?: boolean;
  onChange: (value: string) => void;
  onTipoMensagemChange: (tipo: TipoMensagem) => void;
  onMediaUrlChange: (url: string) => void;
  onSend: () => void;
};

export function WaComposer({
  message,
  tipoMensagem,
  mediaUrl,
  disabled,
  pending,
  onChange,
  onTipoMensagemChange,
  onMediaUrlChange,
  onSend,
}: WaComposerProps) {
  const [plusOpen, setPlusOpen] = useState(false);
  const temTexto = message.trim().length > 0;
  const podeEnviarMidia = tipoMensagem !== "text" && mediaUrl.trim().length > 0;

  function handleSubmit() {
    if (disabled || pending) return;
    if (tipoMensagem === "text" && !temTexto) return;
    if (tipoMensagem !== "text" && !podeEnviarMidia) return;
    onSend();
    setPlusOpen(false);
  }

  return (
    <div className="flex items-end gap-2 border-l border-wa-divider bg-wa-panel-header px-3 py-2.5 md:px-4">
      <Popover open={plusOpen} onOpenChange={setPlusOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            disabled={disabled}
            className="flex h-10 w-10 items-center justify-center rounded-full text-wa-icon transition-colors hover:bg-wa-hover disabled:opacity-40"
            aria-label="Anexar"
          >
            <Plus className="h-6 w-6" />
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-72 space-y-3" align="start">
          <p className="text-sm font-medium">Enviar mídia</p>
          <Select
            value={tipoMensagem}
            onValueChange={(v) => onTipoMensagemChange(v as TipoMensagem)}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="text">Texto</SelectItem>
              <SelectItem value="image">Imagem</SelectItem>
              <SelectItem value="audio">Áudio</SelectItem>
              <SelectItem value="video">Vídeo</SelectItem>
              <SelectItem value="document">Documento</SelectItem>
            </SelectContent>
          </Select>
          {tipoMensagem !== "text" ? (
            <Input
              value={mediaUrl}
              onChange={(e) => onMediaUrlChange(e.target.value)}
              placeholder="URL da mídia (HTTPS)"
              disabled={disabled || pending}
            />
          ) : null}
        </PopoverContent>
      </Popover>

      <WaIconButton disabled label="Figurinhas">
        <Sticker className="h-6 w-6" />
      </WaIconButton>

      <div className="flex flex-1 items-center rounded-lg bg-wa-input px-4 py-2.5">
        <input
          value={message}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              handleSubmit();
            }
          }}
          disabled={disabled || pending}
          placeholder={disabled ? "Sem permissão para enviar" : "Digite uma mensagem"}
          className="flex-1 bg-transparent text-sm text-wa-text placeholder:text-wa-text-muted focus:outline-none"
        />
      </div>

      {temTexto || podeEnviarMidia ? (
        <button
          type="button"
          onClick={handleSubmit}
          disabled={disabled || pending}
          className="flex h-10 w-10 items-center justify-center rounded-full text-wa-icon transition-colors hover:bg-wa-hover disabled:opacity-40"
          aria-label="Enviar"
        >
          <Send className="h-6 w-6" />
        </button>
      ) : (
        <WaIconButton disabled label="Gravar áudio">
          <Mic className="h-6 w-6" />
        </WaIconButton>
      )}
    </div>
  );
}
