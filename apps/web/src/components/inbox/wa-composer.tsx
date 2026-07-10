import { useMutation } from "@tanstack/react-query";
import { Popover, PopoverContent, PopoverTrigger } from "@whasap/ui/components/popover";
import { cn } from "@whasap/ui/lib/utils";
import { FileText, Film, Image, Loader2, Mic, Plus, Send, Sticker, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { WaIconButton } from "@/components/inbox/wa-icon-button";
import { arquivoParaBase64 } from "@/lib/midia-upload";
import { orpc } from "@/lib/orpc";
import { getOrpcErrorMessage } from "@/lib/orpc-error";

export type TipoMidia = "image" | "audio" | "video" | "document";

export type MidiaAnexada = {
  tipo: TipoMidia;
  mediaR2Key: string;
  filename: string;
  previewUrl?: string;
};

type WaComposerProps = {
  conversaId: string;
  message: string;
  midia: MidiaAnexada | null;
  disabled?: boolean;
  pending?: boolean;
  onChange: (value: string) => void;
  onMidiaChange: (midia: MidiaAnexada | null) => void;
  onSend: () => void;
};

const OPCOES_MIDIA = [
  {
    tipo: "image" as const,
    rotulo: "Imagem",
    descricao: "Fotos e imagens",
    icone: Image,
    accept: "image/*",
  },
  {
    tipo: "audio" as const,
    rotulo: "Áudio",
    descricao: "Mensagens de voz e áudio",
    icone: Mic,
    accept: "audio/*",
  },
  {
    tipo: "video" as const,
    rotulo: "Vídeo",
    descricao: "Clipes e gravações",
    icone: Film,
    accept: "video/*",
  },
  {
    tipo: "document" as const,
    rotulo: "Documento",
    descricao: "PDF, planilhas e outros",
    icone: FileText,
    accept: ".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,application/*,text/*",
  },
];

function BotaoOpcaoMidia({
  rotulo,
  descricao,
  icone: Icone,
  disabled,
  carregando,
  onClick,
}: {
  rotulo: string;
  descricao: string;
  icone: typeof Image;
  disabled?: boolean;
  carregando?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled || carregando}
      onClick={onClick}
      className={cn(
        "flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors",
        "hover:bg-wa-hover disabled:cursor-not-allowed disabled:opacity-50",
        carregando && "bg-wa-chip-active",
      )}
    >
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-wa-chip text-wa-icon">
        {carregando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Icone className="h-4 w-4" />}
      </span>
      <span className="min-w-0">
        <span className="block text-sm font-medium text-wa-text">{rotulo}</span>
        <span className="block truncate text-xs text-wa-text-muted">{descricao}</span>
      </span>
    </button>
  );
}

function PreviewMidia({
  midia,
  onRemover,
  disabled,
}: {
  midia: MidiaAnexada;
  onRemover: () => void;
  disabled?: boolean;
}) {
  const rotulo = OPCOES_MIDIA.find((o) => o.tipo === midia.tipo)?.rotulo ?? "Anexo";

  return (
    <div className="flex items-center gap-2 border-b border-wa-divider bg-wa-panel-header px-3 py-2 md:px-4">
      {midia.previewUrl ? (
        <img src={midia.previewUrl} alt="" className="h-10 w-10 shrink-0 rounded-md object-cover" />
      ) : (
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-wa-chip text-wa-icon">
          {midia.tipo === "audio" ? (
            <Mic className="h-4 w-4" />
          ) : midia.tipo === "video" ? (
            <Film className="h-4 w-4" />
          ) : (
            <FileText className="h-4 w-4" />
          )}
        </span>
      )}
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-wa-text">{midia.filename}</p>
        <p className="text-xs text-wa-text-muted">{rotulo} pronto para enviar</p>
      </div>
      <button
        type="button"
        disabled={disabled}
        onClick={onRemover}
        className="rounded-full p-1.5 text-wa-icon transition-colors hover:bg-wa-hover disabled:opacity-40"
        aria-label="Remover anexo"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}

export function WaComposer({
  conversaId,
  message,
  midia,
  disabled,
  pending,
  onChange,
  onMidiaChange,
  onSend,
}: WaComposerProps) {
  const [plusOpen, setPlusOpen] = useState(false);
  const [uploadTipo, setUploadTipo] = useState<TipoMidia | null>(null);
  const [erroUpload, setErroUpload] = useState<string | null>(null);
  const inputsRef = useRef<Partial<Record<TipoMidia, HTMLInputElement | null>>>({});

  const temTexto = message.trim().length > 0;
  const podeEnviar = midia != null || temTexto;

  const upload = useMutation(orpc.caixaEntrada.midia.upload.mutationOptions());

  useEffect(() => {
    return () => {
      if (midia?.previewUrl) URL.revokeObjectURL(midia.previewUrl);
    };
  }, [midia?.previewUrl]);

  function limparMidia() {
    if (midia?.previewUrl) URL.revokeObjectURL(midia.previewUrl);
    onMidiaChange(null);
    setErroUpload(null);
  }

  async function handleArquivo(tipo: TipoMidia, arquivo: File | undefined) {
    if (!arquivo || disabled || upload.isPending) return;

    setErroUpload(null);
    setUploadTipo(tipo);

    try {
      const dados = await arquivoParaBase64(arquivo);
      const resultado = await upload.mutateAsync({
        conversaId,
        tipo,
        nomeArquivo: arquivo.name,
        tipoConteudo: arquivo.type || "application/octet-stream",
        dados,
      });

      if (midia?.previewUrl) URL.revokeObjectURL(midia.previewUrl);

      const previewUrl = tipo === "image" ? URL.createObjectURL(arquivo) : undefined;

      onMidiaChange({
        tipo,
        mediaR2Key: resultado.mediaR2Key,
        filename: arquivo.name,
        previewUrl,
      });
      setPlusOpen(false);
    } catch (error) {
      setErroUpload(getOrpcErrorMessage(error, "Falha ao enviar o arquivo"));
    } finally {
      setUploadTipo(null);
      const input = inputsRef.current[tipo];
      if (input) input.value = "";
    }
  }

  function handleSubmit() {
    if (disabled || pending || !podeEnviar) return;
    onSend();
    setPlusOpen(false);
  }

  const placeholder = midia
    ? midia.tipo === "audio"
      ? "Descrição opcional"
      : "Legenda (opcional)"
    : disabled
      ? "Sem permissão para enviar"
      : "Digite uma mensagem";

  return (
    <div className="border-l border-wa-divider">
      {midia ? (
        <PreviewMidia midia={midia} onRemover={limparMidia} disabled={disabled || pending} />
      ) : null}

      <div className="flex items-end gap-2 bg-wa-panel-header px-3 py-2.5 md:px-4">
        <Popover open={plusOpen} onOpenChange={setPlusOpen}>
          <PopoverTrigger asChild>
            <button
              type="button"
              disabled={disabled || upload.isPending}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-wa-icon transition-colors hover:bg-wa-hover disabled:opacity-40"
              aria-label="Anexar"
            >
              {upload.isPending ? (
                <Loader2 className="h-6 w-6 animate-spin" />
              ) : (
                <Plus className="h-6 w-6" />
              )}
            </button>
          </PopoverTrigger>
          <PopoverContent className="w-80 p-2" align="start">
            <p className="px-2 pb-1 pt-0.5 text-sm font-medium text-wa-text">Anexar arquivo</p>
            <div className="space-y-0.5">
              {OPCOES_MIDIA.map((opcao) => (
                <div key={opcao.tipo}>
                  <input
                    ref={(el) => {
                      inputsRef.current[opcao.tipo] = el;
                    }}
                    type="file"
                    accept={opcao.accept}
                    className="hidden"
                    disabled={disabled || upload.isPending}
                    onChange={(e) => void handleArquivo(opcao.tipo, e.target.files?.[0])}
                  />
                  <BotaoOpcaoMidia
                    rotulo={opcao.rotulo}
                    descricao={opcao.descricao}
                    icone={opcao.icone}
                    disabled={disabled}
                    carregando={uploadTipo === opcao.tipo}
                    onClick={() => inputsRef.current[opcao.tipo]?.click()}
                  />
                </div>
              ))}
            </div>
            {erroUpload ? <p className="px-2 pt-2 text-xs text-destructive">{erroUpload}</p> : null}
            {upload.isPending && uploadTipo ? (
              <p className="px-2 pt-2 text-xs text-wa-text-muted">Enviando arquivo...</p>
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
            placeholder={placeholder}
            className="flex-1 bg-transparent text-sm text-wa-text placeholder:text-wa-text-muted focus:outline-none"
          />
        </div>

        {podeEnviar ? (
          <button
            type="button"
            onClick={handleSubmit}
            disabled={disabled || pending || upload.isPending}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-wa-icon transition-colors hover:bg-wa-hover disabled:opacity-40"
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
    </div>
  );
}
