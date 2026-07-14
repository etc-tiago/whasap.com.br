import type { AjustesSecao } from "@/lib/ajustes-search";

type SearchPrev = {
  ajustes?: AjustesSecao;
  convidar?: "1";
  [key: string]: unknown;
};

/** Patch de search para abrir o modal numa seção. */
export function searchAbrirAjustes(secao: AjustesSecao = "geral") {
  return (prev: SearchPrev) => ({
    ...prev,
    ajustes: secao,
  });
}

/** Patch de search para fechar o modal e limpar `convidar`. */
export function searchFecharAjustes() {
  return (prev: SearchPrev) => {
    const { ajustes: _a, convidar: _c, ...rest } = prev;
    return rest;
  };
}
