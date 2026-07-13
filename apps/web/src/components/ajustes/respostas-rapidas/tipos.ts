export type TipoItem = "text" | "image" | "document";

export type ItemForm = {
  chaveLocal: string;
  tipo: TipoItem;
  corpo: string;
  mediaR2Key: string | null;
  mediaUrl: string | null;
  nomeArquivo: string | null;
};

export function rotuloTipo(tipo: TipoItem) {
  if (tipo === "text") return "Texto";
  if (tipo === "image") return "Imagem";
  return "Documento";
}

export function criarItemVazio(tipo: TipoItem): ItemForm {
  return {
    chaveLocal: crypto.randomUUID(),
    tipo,
    corpo: "",
    mediaR2Key: null,
    mediaUrl: null,
    nomeArquivo: null,
  };
}
