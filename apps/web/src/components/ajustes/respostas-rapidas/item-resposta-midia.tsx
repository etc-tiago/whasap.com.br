import { useMutation } from "@tanstack/react-query";
import { Button } from "@whasap/ui/components/button";
import { Textarea } from "@whasap/ui/components/textarea";
import { FileText, Image, Loader2, Plus } from "lucide-react";
import { useRef, useState } from "react";

import { arquivoParaBase64 } from "@/lib/midia-upload";
import { orpc } from "@/lib/orpc";
import { getOrpcErrorMessage } from "@/lib/orpc-error";

import { CabecalhoItem } from "./item-resposta-texto";
import { rotuloTipo, type ItemForm } from "./tipos";

type ItemRespostaMidiaProps = {
  organizacaoHash: string;
  item: ItemForm;
  indice: number;
  total: number;
  onChange: (patch: Partial<ItemForm>) => void;
  onMover: (direcao: -1 | 1) => void;
  onRemover: () => void;
};

/**
 * Item de imagem/documento da sequência.
 * Um único `useMutation` de upload.
 */
export function ItemRespostaMidia({
  organizacaoHash,
  item,
  indice,
  total,
  onChange,
  onMover,
  onRemover,
}: ItemRespostaMidiaProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [erroUpload, setErroUpload] = useState<string | null>(null);

  const upload = useMutation(orpc.caixaEntrada.respostasRapidas.midia.upload.mutationOptions());

  async function onArquivo(arquivo: File | undefined) {
    if (!arquivo || item.tipo === "text") return;
    setErroUpload(null);
    try {
      const dados = await arquivoParaBase64(arquivo);
      const resultado = await upload.mutateAsync({
        organizacaoHash,
        tipo: item.tipo,
        nomeArquivo: arquivo.name,
        tipoConteudo: arquivo.type || "application/octet-stream",
        dados,
      });
      onChange({
        mediaR2Key: resultado.mediaR2Key,
        mediaUrl: resultado.mediaUrl,
        nomeArquivo: arquivo.name,
      });
    } catch (err) {
      setErroUpload(getOrpcErrorMessage(err, "Falha no upload."));
    }
  }

  return (
    <div className="rounded-lg border border-wa-divider bg-wa-hover/40 p-3">
      <CabecalhoItem
        indice={indice}
        total={total}
        rotulo={rotuloTipo(item.tipo)}
        icone={item.tipo === "image" ? Image : FileText}
        onMover={onMover}
        onRemover={onRemover}
      />

      <div className="space-y-2">
        <input
          ref={inputRef}
          type="file"
          className="hidden"
          accept={
            item.tipo === "image"
              ? "image/*"
              : ".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,application/*,text/*"
          }
          onChange={(e) => {
            void onArquivo(e.target.files?.[0]);
            e.target.value = "";
          }}
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={upload.isPending}
          onClick={() => inputRef.current?.click()}
        >
          {upload.isPending ? (
            <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
          ) : (
            <Plus className="mr-1.5 h-4 w-4" />
          )}
          {item.mediaR2Key ? "Trocar arquivo" : "Enviar arquivo"}
        </Button>
        {item.tipo === "image" && item.mediaUrl ? (
          <img
            src={item.mediaUrl}
            alt={item.nomeArquivo ?? "Prévia"}
            className="max-h-36 rounded-md border border-wa-divider object-contain"
          />
        ) : null}
        {item.nomeArquivo ? (
          <p className="truncate text-xs text-wa-text-muted">{item.nomeArquivo}</p>
        ) : null}
        <Textarea
          value={item.corpo}
          onChange={(e) => onChange({ corpo: e.target.value })}
          rows={2}
          placeholder="Legenda (opcional)"
        />
        {erroUpload ? <p className="text-xs text-destructive">{erroUpload}</p> : null}
      </div>
    </div>
  );
}
