import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

export type TemaPreferencia = "light" | "dark" | "system";

const STORAGE_KEY = "whasap-tema";

type TemaContextValue = {
  preferencia: TemaPreferencia;
  setPreferencia: (preferencia: TemaPreferencia) => void;
  resolvido: "light" | "dark";
};

const TemaContext = createContext<TemaContextValue | null>(null);

function lerPreferenciaSalva(): TemaPreferencia {
  if (typeof window === "undefined") return "light";
  const salvo = localStorage.getItem(STORAGE_KEY);
  if (salvo === "dark" || salvo === "system") return salvo;
  return "light";
}

function resolverTema(preferencia: TemaPreferencia): "light" | "dark" {
  if (preferencia === "system") {
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  }
  return preferencia;
}

function aplicarTemaNoDocumento(resolvido: "light" | "dark") {
  document.documentElement.classList.toggle("dark", resolvido === "dark");
}

export function TemaProvider({ children }: { children: ReactNode }) {
  const [preferencia, setPreferenciaState] = useState<TemaPreferencia>(lerPreferenciaSalva);

  const setPreferencia = useCallback((nova: TemaPreferencia) => {
    setPreferenciaState(nova);
    localStorage.setItem(STORAGE_KEY, nova);
  }, []);

  const resolvido = useMemo(() => resolverTema(preferencia), [preferencia]);

  useEffect(() => {
    aplicarTemaNoDocumento(resolvido);
  }, [resolvido]);

  useEffect(() => {
    if (preferencia !== "system") return;
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const atualizar = () => aplicarTemaNoDocumento(resolverTema("system"));
    media.addEventListener("change", atualizar);
    return () => media.removeEventListener("change", atualizar);
  }, [preferencia]);

  const value = useMemo(
    () => ({ preferencia, setPreferencia, resolvido }),
    [preferencia, setPreferencia, resolvido],
  );

  return <TemaContext.Provider value={value}>{children}</TemaContext.Provider>;
}

export function useTema() {
  const ctx = useContext(TemaContext);
  if (!ctx) {
    throw new Error("useTema deve ser usado dentro de TemaProvider");
  }
  return ctx;
}

/** Aplica tema salvo antes da hidratação React (evita flash). */
export function scriptTemaInicial(): string {
  return `(function(){try{var p=localStorage.getItem("${STORAGE_KEY}");var d=p==="dark"||(p!=="light"&&window.matchMedia("(prefers-color-scheme: dark)").matches);document.documentElement.classList.toggle("dark",d);}catch(e){}})();`;
}
