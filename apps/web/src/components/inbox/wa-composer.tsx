import { useMutation, useQuery } from "@tanstack/react-query";
import { Popover, PopoverContent, PopoverTrigger } from "@whasap/ui/components/popover";
import { cn } from "@whasap/ui/lib/utils";
import {
  FileText,
  Film,
  Image,
  Loader2,
  MessageSquareText,
  Mic,
  Plus,
  Reply,
  Send,
  Sticker,
  X,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { WaIconButton } from "@/components/inbox/wa-icon-button";
import { formatarPreviewMensagem } from "@/lib/inbox-utils";
import { arquivoParaBase64 } from "@/lib/midia-upload";
import { orgInput } from "@/lib/org-input";
import { orpc, orpcClient, type MensagemItem } from "@/lib/orpc";
import { getOrpcErrorMessage } from "@/lib/orpc-error";

export type TipoMidia = "image" | "audio" | "video" | "document";

export type MidiaAnexada = {
  tipo: TipoMidia;
  mediaR2Key: string;
  filename: string;
  previewUrl?: string;
};

/** Item de sequência de resposta rápida na fila do composer. */
export type ItemFilaRespostaRapida = {
  chaveLocal: string;
  tipo: "text" | "image" | "document";
  corpo: string;
  mediaR2Key: string | null;
  mediaUrl: string | null;
  nomeArquivo: string | null;
};

type WaComposerProps = {
  conversaId: string;
  organizacaoHash: string;
  message: string;
  midia: MidiaAnexada | null;
  fila: ItemFilaRespostaRapida[] | null;
  mensagemResposta?: MensagemItem | null;
  disabled?: boolean;
  pending?: boolean;
  podeUsarRespostasRapidas?: boolean;
  onChange: (value: string) => void;
  onMidiaChange: (midia: MidiaAnexada | null) => void;
  onFilaChange: (fila: ItemFilaRespostaRapida[] | null) => void;
  onLimparResposta?: () => void;
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
    descricao: "Apenas MP4",
    icone: Film,
    accept: "video/mp4,.mp4",
  },
  {
    tipo: "document" as const,
    rotulo: "Documento",
    descricao: "PDF, planilhas e outros",
    icone: FileText,
    accept: ".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,application/*,text/*",
  },
];

/** Evolution GO / Meta só aceitam MP4 no envio de vídeo. */
function validarArquivoMidia(tipo: TipoMidia, arquivo: File): string | null {
  if (tipo !== "video") return null;

  const mime = (arquivo.type || "").split(";")[0]?.trim().toLowerCase() ?? "";
  const pontinho = arquivo.name.lastIndexOf(".");
  const ext = pontinho > 0 ? arquivo.name.slice(pontinho + 1).toLowerCase() : "";

  const mimeOk = mime === "video/mp4" || (mime === "" && ext === "mp4");
  const extOk = !ext || ext === "mp4";

  if (!mimeOk || !extOk) {
    return "Use um vídeo em MP4. Arquivos MOV (gravações do Mac/iPhone) não são suportados.";
  }
  return null;
}

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

function PreviewMensagemResposta({
  mensagem,
  onLimpar,
  disabled,
}: {
  mensagem: MensagemItem;
  onLimpar: () => void;
  disabled?: boolean;
}) {
  const preview = formatarPreviewMensagem(mensagem.body, mensagem.type) || "Mensagem";
  const autor =
    mensagem.direction === "outbound"
      ? (mensagem.enviadoPorNome ?? "Você")
      : "Contato";

  return (
    <div className="flex items-stretch gap-2 border-b border-wa-divider bg-wa-panel-header px-3 py-2 md:px-4">
      <div className="flex min-w-0 flex-1 items-start gap-2 rounded-md border-l-4 border-wa-green bg-wa-input px-2.5 py-2">
        <Reply className="mt-0.5 h-3.5 w-3.5 shrink-0 text-wa-green" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-xs font-medium text-wa-green">{autor}</p>
          <p className="truncate text-sm text-wa-text-muted">{preview}</p>
        </div>
      </div>
      <button
        type="button"
        disabled={disabled}
        onClick={onLimpar}
        className="rounded-full p-1.5 text-wa-icon hover:bg-wa-hover disabled:opacity-40"
        aria-label="Cancelar resposta"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
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

function PreviewFila({
  fila,
  disabled,
  onFilaChange,
}: {
  fila: ItemFilaRespostaRapida[];
  disabled?: boolean;
  onFilaChange: (fila: ItemFilaRespostaRapida[] | null) => void;
}) {
  return (
    <div className="space-y-2 border-b border-wa-divider bg-wa-panel-header px-3 py-2 md:px-4">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-medium text-wa-text-muted">
          Sequência · {fila.length} {fila.length === 1 ? "mensagem" : "mensagens"}
        </p>
        <button
          type="button"
          disabled={disabled}
          onClick={() => onFilaChange(null)}
          className="text-xs text-wa-icon hover:text-wa-text disabled:opacity-40"
        >
          Limpar
        </button>
      </div>
      {fila.map((item, idx) => (
        <div
          key={item.chaveLocal}
          className="flex items-start gap-2 rounded-md border border-wa-divider bg-wa-input px-2.5 py-2"
        >
          <span className="mt-1.5 text-[10px] font-medium text-wa-text-muted">{idx + 1}</span>
          {item.tipo === "image" && item.mediaUrl ? (
            <img
              src={item.mediaUrl}
              alt=""
              className="mt-0.5 h-10 w-10 shrink-0 rounded object-cover"
            />
          ) : item.tipo === "document" ? (
            <span className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded bg-wa-chip text-wa-icon">
              <FileText className="h-4 w-4" />
            </span>
          ) : null}
          <div className="min-w-0 flex-1">
            {item.tipo !== "text" && item.nomeArquivo ? (
              <p className="mb-1 truncate text-xs text-wa-text-muted">{item.nomeArquivo}</p>
            ) : null}
            <input
              value={item.corpo}
              disabled={disabled}
              onChange={(e) =>
                onFilaChange(
                  fila.map((x) =>
                    x.chaveLocal === item.chaveLocal ? { ...x, corpo: e.target.value } : x,
                  ),
                )
              }
              placeholder={item.tipo === "text" ? "Texto" : "Legenda (opcional)"}
              className="w-full bg-transparent text-sm text-wa-text placeholder:text-wa-text-muted focus:outline-none disabled:opacity-50"
            />
          </div>
          <button
            type="button"
            disabled={disabled || fila.length <= 1}
            onClick={() => {
              const proxima = fila.filter((x) => x.chaveLocal !== item.chaveLocal);
              onFilaChange(proxima.length ? proxima : null);
            }}
            className="rounded-full p-1 text-wa-icon hover:bg-wa-hover disabled:opacity-40"
            aria-label="Remover mensagem da sequência"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      ))}
    </div>
  );
}

function PickerRespostasRapidas({
  organizacaoHash,
  disabled,
  onAplicar,
}: {
  organizacaoHash: string;
  disabled?: boolean;
  onAplicar: (itens: ItemFilaRespostaRapida[]) => void;
}) {
  const [aberto, setAberto] = useState(false);
  const [busca, setBusca] = useState("");
  const [carregandoId, setCarregandoId] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  const lista = useQuery(
    orpc.caixaEntrada.respostasRapidas.lista.queryOptions({
      input: orgInput(organizacaoHash),
      enabled: aberto,
    }),
  );

  const filtradas = (lista.data ?? []).filter((item) => {
    const q = busca.trim().toLowerCase();
    if (!q) return true;
    return item.titulo.toLowerCase().includes(q) || (item.preview ?? "").toLowerCase().includes(q);
  });

  async function escolher(id: string) {
    setErro(null);
    setCarregandoId(id);
    try {
      const detalhe = await orpcClient.caixaEntrada.respostasRapidas.obter({
        organizacaoHash,
        id,
      });
      onAplicar(
        detalhe.itens.map((item) => ({
          chaveLocal: crypto.randomUUID(),
          tipo: item.tipo,
          corpo: item.corpo ?? "",
          mediaR2Key: item.mediaR2Key,
          mediaUrl: item.mediaUrl,
          nomeArquivo: item.nomeArquivo,
        })),
      );
      setAberto(false);
      setBusca("");
    } catch (err) {
      setErro(getOrpcErrorMessage(err, "Não foi possível carregar a resposta."));
    } finally {
      setCarregandoId(null);
    }
  }

  return (
    <Popover open={aberto} onOpenChange={setAberto}>
      <PopoverTrigger asChild>
        <button
          type="button"
          disabled={disabled}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-wa-icon transition-colors hover:bg-wa-hover disabled:opacity-40"
          aria-label="Respostas rápidas"
          title="Respostas rápidas"
        >
          <MessageSquareText className="h-5 w-5" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-2" align="start">
        <p className="px-2 pb-1 pt-0.5 text-sm font-medium text-wa-text">Respostas rápidas</p>
        <input
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          placeholder="Buscar…"
          className="mb-1 w-full rounded-md bg-wa-input px-3 py-2 text-sm text-wa-text placeholder:text-wa-text-muted focus:outline-none"
        />
        <div className="max-h-64 space-y-0.5 overflow-y-auto">
          {lista.isLoading ? (
            <p className="px-2 py-3 text-xs text-wa-text-muted">Carregando…</p>
          ) : filtradas.length === 0 ? (
            <p className="px-2 py-3 text-xs text-wa-text-muted">Nenhuma resposta encontrada.</p>
          ) : (
            filtradas.map((item) => (
              <button
                key={item.id}
                type="button"
                disabled={carregandoId !== null}
                onClick={() => void escolher(item.id)}
                className="flex w-full items-start gap-2 rounded-lg px-2 py-2 text-left hover:bg-wa-hover disabled:opacity-50"
              >
                <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-wa-chip text-wa-icon">
                  {carregandoId === item.id ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <MessageSquareText className="h-3.5 w-3.5" />
                  )}
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-sm font-medium text-wa-text">
                    {item.titulo}
                  </span>
                  <span className="block truncate text-xs text-wa-text-muted">
                    {item.quantidadeItens} {item.quantidadeItens === 1 ? "mensagem" : "mensagens"}
                    {item.preview ? ` · ${item.preview}` : ""}
                  </span>
                </span>
              </button>
            ))
          )}
        </div>
        {erro ? <p className="px-2 pt-2 text-xs text-destructive">{erro}</p> : null}
      </PopoverContent>
    </Popover>
  );
}

export function WaComposer({
  conversaId,
  organizacaoHash,
  message,
  midia,
  fila,
  mensagemResposta = null,
  disabled,
  pending,
  podeUsarRespostasRapidas = true,
  onChange,
  onMidiaChange,
  onFilaChange,
  onLimparResposta,
  onSend,
}: WaComposerProps) {
  const [plusOpen, setPlusOpen] = useState(false);
  const [uploadTipo, setUploadTipo] = useState<TipoMidia | null>(null);
  const [erroUpload, setErroUpload] = useState<string | null>(null);
  const inputsRef = useRef<Partial<Record<TipoMidia, HTMLInputElement | null>>>({});

  const temFila = (fila?.length ?? 0) > 0;
  const temTexto = message.trim().length > 0;
  const filaValida =
    temFila &&
    (fila ?? []).every((item) =>
      item.tipo === "text" ? item.corpo.trim().length > 0 : Boolean(item.mediaR2Key),
    );
  const podeEnviar = temFila ? filaValida : midia != null || temTexto;

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

  function aplicarResposta(itens: ItemFilaRespostaRapida[]) {
    if (itens.length === 0) return;

    if (itens.length === 1) {
      const unico = itens[0]!;
      onFilaChange(null);
      if (unico.tipo === "text") {
        limparMidia();
        onChange(unico.corpo);
        return;
      }
      onChange(unico.corpo);
      onMidiaChange({
        tipo: unico.tipo,
        mediaR2Key: unico.mediaR2Key!,
        filename: unico.nomeArquivo ?? (unico.tipo === "image" ? "imagem" : "documento"),
        previewUrl: unico.tipo === "image" ? (unico.mediaUrl ?? undefined) : undefined,
      });
      return;
    }

    limparMidia();
    onChange("");
    onFilaChange(itens);
  }

  async function handleArquivo(tipo: TipoMidia, arquivo: File | undefined) {
    if (!arquivo || disabled || upload.isPending) return;

    setErroUpload(null);

    const erroLocal = validarArquivoMidia(tipo, arquivo);
    if (erroLocal) {
      setErroUpload(erroLocal);
      const input = inputsRef.current[tipo];
      if (input) input.value = "";
      return;
    }

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

      onFilaChange(null);
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
      {mensagemResposta && onLimparResposta ? (
        <PreviewMensagemResposta
          mensagem={mensagemResposta}
          onLimpar={onLimparResposta}
          disabled={disabled || pending}
        />
      ) : null}
      {temFila && fila ? (
        <PreviewFila fila={fila} disabled={disabled || pending} onFilaChange={onFilaChange} />
      ) : midia ? (
        <PreviewMidia midia={midia} onRemover={limparMidia} disabled={disabled || pending} />
      ) : null}

      <div className="flex items-end gap-2 bg-wa-panel-header px-3 py-2.5 md:px-4">
        <Popover open={plusOpen} onOpenChange={setPlusOpen}>
          <PopoverTrigger asChild>
            <button
              type="button"
              disabled={disabled || upload.isPending || temFila}
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

        {podeUsarRespostasRapidas ? (
          <PickerRespostasRapidas
            organizacaoHash={organizacaoHash}
            disabled={disabled || pending}
            onAplicar={aplicarResposta}
          />
        ) : (
          <WaIconButton disabled label="Figurinhas">
            <Sticker className="h-6 w-6" />
          </WaIconButton>
        )}

        <div className="flex flex-1 items-center rounded-lg bg-wa-input px-4 py-2.5">
          {temFila ? (
            <p className="flex-1 text-sm text-wa-text-muted">Revise a sequência acima e envie</p>
          ) : (
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
          )}
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
