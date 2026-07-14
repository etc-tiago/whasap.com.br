/**
 * Detecta inatividade do usuário (mouse/teclado/touch) com threshold configurável.
 */
import { useEffect, useState } from "react";

const EVENTOS_ATIVIDADE = ["mousemove", "mousedown", "keydown", "touchstart", "scroll"] as const;

/**
 * @param thresholdMs Tempo sem atividade para considerar idle (padrão 60s).
 * @returns `idle` true quando passou o threshold sem interação; false enquanto ativo.
 */
export function useMouseIdle(thresholdMs = 60_000): { idle: boolean } {
  const [idle, setIdle] = useState(false);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;

    const reiniciar = () => {
      setIdle(false);
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => setIdle(true), thresholdMs);
    };

    reiniciar();

    for (const ev of EVENTOS_ATIVIDADE) {
      window.addEventListener(ev, reiniciar, { passive: true });
    }
    document.addEventListener("visibilitychange", reiniciar);

    return () => {
      if (timer) clearTimeout(timer);
      for (const ev of EVENTOS_ATIVIDADE) {
        window.removeEventListener(ev, reiniciar);
      }
      document.removeEventListener("visibilitychange", reiniciar);
    };
  }, [thresholdMs]);

  return { idle };
}
