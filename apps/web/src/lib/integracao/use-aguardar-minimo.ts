import { useEffect, useState } from "react";

/** Garante tempo mínimo de exibição (ex.: tela de sincronia 5s). */
export function useAguardarMinimo(ms: number): boolean {
  const [pronto, setPronto] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setPronto(true), ms);
    return () => clearTimeout(t);
  }, [ms]);

  return pronto;
}
